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
  const all = [...appData.fridge, ...appData.freezer, ...appData.pantry];
  if (!all.length) return null;

  const urgent = all.filter(i => ['warn', 'expired'].includes(expiryStatus(i.exp)));
  const normal = all.filter(i => !['warn', 'expired'].includes(expiryStatus(i.exp)));

  let s = 'STOCK:\n';
  if (urgent.length) { s += 'Urgence:\n';    urgent.forEach(i => s += `- ${i.name} x${i.qty}\n`); }
  if (normal.length) { s += 'Disponible:\n'; normal.forEach(i => s += `- ${i.name} x${i.qty}\n`); }
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
            ${m.note ? `<div class="meal-note">${esc(m.note)}</div>` : ''}
            ${(m.stock_items || []).length ? `
              <div class="meal-stock-items">
                ${m.stock_items.map(s => `<span class="meal-stock-tag">📦 ${esc(s)}</span>`).join('')}
              </div>` : ''}
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

  const timeLabel = {
    rapide: 'maximum 20 min, recettes simples',
    mijote: 'plats mijotés longtemps, en sauce',
  }[menuTime] || '30 à 45 minutes';

  const menuExtra = document.getElementById('menu-extra').value.trim();
  const stock     = buildStockSummary();
  const mealsStr  = [...menuMeals].join(', ');

  const prompt = `Tu es un diététicien-cuisinier français expert en cuisine du quotidien.

${menuExtra ? `⛔ INTERDICTIONS ABSOLUES — ne jamais utiliser ces ingrédients dans aucun plat : ${menuExtra}. Vérifie chaque plat proposé.` : ''}

${stock}
CONTRAINTES:
- ${parseInt(menuDays)} jour(s), repas: ${mealsStr}
- Régime: ${menuDiet}
- Priorité: ${menuPrio}
- Temps: ${timeLabel}
- Cuisine française et méditerranéenne uniquement
- OBLIGATOIRE: chaque déjeuner/dîner = protéine (viande/poisson/oeuf) + féculent (riz/pâtes/semoule) + légume
- Petit-déjeuner: pain + laitage + fruit
- Utilise au max les produits du stock

JSON uniquement, sans markdown:
{"days":[{"label":"Jour 1","meals":[{"type":"Déjeuner","dish":"Nom du plat","note":"conseil de préparation court","stock_items":["Nom exact produit 1","Nom exact produit 2"]}]}]}

- stock_items: noms EXACTS des produits du stock à sortir pour ce repas (recopie les noms tels quels depuis la liste stock)`;

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
        temperature: 0.7,
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
