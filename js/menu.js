// ─────────────────────────────────────────────
// GÉNÉRATION DE MENUS (Mistral AI)
// ─────────────────────────────────────────────

// ─── Chips de sélection ───────────────────────

function selectChip(btn, group) {
  document.getElementById('chips-' + group)
    .querySelectorAll('.chip')
    .forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  if (group === 'days') menuDays = btn.dataset.val;
  if (group === 'diet') menuDiet = btn.dataset.val;
  if (group === 'prio') menuPrio = btn.dataset.val;
  if (group === 'time') menuTime = btn.dataset.val;
}

function toggleChip(btn) {
  const val = btn.dataset.val;
  if (menuMeals.has(val)) {
    if (menuMeals.size === 1) return; // garder au moins 1 repas
    menuMeals.delete(val);
    btn.classList.remove('selected');
  } else {
    menuMeals.add(val);
    btn.classList.add('selected');
  }
}

// ─── Résumé du stock pour le prompt ──────────

function buildStockSummary() {
  const locLabel = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' };
  const urgent = [], normal = [];
  ['fridge', 'freezer', 'pantry'].forEach(loc => {
    appData[loc].forEach(i => {
      const entry = `- ${i.name} x${i.qty} [${locLabel[loc]}]`;
      (['warn', 'expired'].includes(expiryStatus(i.exp)) ? urgent : normal).push(entry);
    });
  });
  if (!urgent.length && !normal.length) return null;
  let s = '';
  if (urgent.length) s += `URGENT (expire bientôt — à utiliser en priorité absolue):\n${urgent.join('\n')}\n\n`;
  if (normal.length) s += `DISPONIBLE:\n${normal.join('\n')}`;
  return s;
}

// ─── Affichage des résultats ─────────────────

function renderMenuDays(days, el) {
  if (!days.length) {
    el.innerHTML = '<div style="color:var(--text-faint);">Aucun menu généré.</div>';
    return;
  }
  el.innerHTML = days.map(day =>
    `<div class="menu-day">
      <div class="menu-day-title">${esc(day.label || '')}</div>
      ${(day.meals || []).map(m => `
        <div class="menu-meal">
          <span class="meal-type">${esc(m.type || '')}</span>
          <div class="meal-body">
            <div class="meal-name">${esc(m.dish || '')}</div>
            ${(m.stock_items || []).length ? `
              <div class="meal-stock-items">
                ${m.stock_items.map(s => `<span class="meal-stock-tag">📦 ${esc(s)}</span>`).join('')}
              </div>` : ''}
            ${(m.steps || []).length ? `
              <ol class="meal-steps">
                ${m.steps.map(s => `<li class="meal-step">${esc(s)}</li>`).join('')}
              </ol>` : ''}
          </div>
        </div>`).join('')}
    </div>`
  ).join('');
}

// ─── Génération via Mistral ───────────────────

async function generateMenus() {
  const all = [...appData.fridge, ...appData.freezer, ...appData.pantry];
  const resultEl  = document.getElementById('menu-result');
  const contentEl = document.getElementById('menu-result-content');

  if (!all.length) {
    resultEl.classList.add('show');
    contentEl.innerHTML = '<div style="color:var(--text-faint);">Stock vide !</div>';
    return;
  }
  if (!mistralKey) {
    showToast('Clé Mistral non configurée dans Supabase (table config).');
    return;
  }

  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  btn.textContent = 'Génération en cours…';
  resultEl.classList.add('show');
  contentEl.innerHTML = Array(5).fill('<div class="skeleton-line"></div>').join('');

  const timeLimits = { rapide: '⚡ MOINS DE 20 MINUTES — plats simples, rien qui mijote', normal: '30 à 45 minutes', mijote: '1 heure ou plus, plats mijotés' };
  const timeLabel  = timeLimits[menuTime] || timeLimits.normal;

  const menuExtra = document.getElementById('menu-extra').value.trim();
  const stock     = buildStockSummary();
  const mealsStr  = [...menuMeals].join(', ');

  const prompt = `Tu es un assistant cuisine. Génère des menus en respectant STRICTEMENT toutes les contraintes.

${menuExtra ? `⛔ INTERDIT absolument : ${menuExtra}.\n` : ''}STOCK (utiliser UNIQUEMENT ces produits — sel, poivre, huile autorisés):
${stock}

CONTRAINTES STRICTES:
1. ${parseInt(menuDays)} jour(s), repas à inclure : ${mealsStr}
2. Régime : ${menuDiet}
3. Temps de préparation : ${timeLabel} — NE PAS DÉPASSER
4. Priorité : ${menuPrio}
5. N'utilise QUE des produits listés dans le stock ci-dessus. Si un produit manque pour un plat, choisis un autre plat.
6. Ne mentionne JAMAIS un produit absent du stock dans stock_items.

FORMAT JSON strict, sans markdown :
{"days":[{"label":"Jour 1","meals":[{"type":"Déjeuner","dish":"Nom du plat","stock_items":["nom exact du produit tel qu'écrit dans le stock"],"steps":["Étape 1.","Étape 2.","Étape 3."]}]}]}

Règles steps (obligatoires) :
- 2 à 4 étapes, 1 phrase chacune, ultra-concrètes
- Si produit congelé : commencer par "Sortir [nom] du congélateur."
- Inclure température four et durée exactes si applicable
- Dernière étape = service/dressage`;

  try {
    const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + mistralKey,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j?.message || r.statusText);

    const raw  = (j.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '');
    const days = JSON.parse(raw).days || [];
    renderMenuDays(days, contentEl);

    if (days.length) {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:0.72rem;color:var(--text-faint);margin-top:12px;padding-top:12px;border-top:1px solid var(--border);';
      note.textContent = '✦ Menus générés par Mistral AI';
      contentEl.appendChild(note);
    }
  } catch (err) {
    contentEl.innerHTML = `<div style="color:var(--expired);font-size:0.83rem;">❌ ${esc(err.message)}</div>`;
  }

  btn.disabled = false;
  btn.innerHTML = '✦ &nbsp;Régénérer';
}

// ─── Ouverture / fermeture ────────────────────

function openMenu() {
  document.getElementById('modal-menu').classList.add('open');
  document.getElementById('menu-result').classList.remove('show');
  document.getElementById('menu-result-content').innerHTML = '';
  document.getElementById('btn-generate').disabled = false;
  document.getElementById('btn-generate').innerHTML = '✦ &nbsp;Générer les menus';
}

function closeMenu()      { document.getElementById('modal-menu').classList.remove('open'); }
function closeMenuOnBg(e) { if (e.target === document.getElementById('modal-menu')) closeMenu(); }
