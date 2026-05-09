// ─────────────────────────────────────────────
// GÉNÉRATION DE MENUS (IA multi-provider)
// ─────────────────────────────────────────────

// ─── Chips de sélection ───────────────────────

function selectChip(btn, group) {
  document.getElementById('chips-' + group)
    .querySelectorAll('.chip')
    .forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  if (group === 'days')    menuDays    = btn.dataset.val;
  if (group === 'diet')    menuDiet    = btn.dataset.val;
  if (group === 'prio')    menuPrio    = btn.dataset.val;
  if (group === 'time')    menuTime    = btn.dataset.val;
  if (group === 'persons') menuPersons = btn.dataset.val;
}

function toggleChip(btn) {
  const val = btn.dataset.val;
  if (menuMeals.has(val)) {
    if (menuMeals.size === 1) return;
    menuMeals.delete(val);
    btn.classList.remove('selected');
  } else {
    menuMeals.add(val);
    btn.classList.add('selected');
  }
}

function selectAI(btn) {
  document.getElementById('chips-ai')
    .querySelectorAll('.chip')
    .forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  menuAI = btn.dataset.val;
}

function toggleBatch(btn) {
  menuBatch = !menuBatch;
  btn.classList.toggle('selected', menuBatch);
  if (menuBatch) {
    document.getElementById('chips-days').querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('selected', c.dataset.val === '3');
    });
    menuDays = '3';
  }
}

// ─── Résumé du stock pour le prompt ──────────

function buildStockSummary() {
  const locLabel = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' };
  const urgent = [], normal = [];
  ['fridge', 'freezer', 'pantry'].forEach(loc => {
    appData[loc].forEach(i => {
      const entry = `- ${i.name} : x${i.qty} [${locLabel[loc]}]`;
      (['warn', 'expired'].includes(expiryStatus(i.exp)) ? urgent : normal).push(entry);
    });
  });
  if (!urgent.length && !normal.length) return null;
  let s = '';
  if (urgent.length) s += `⚠️ URGENT — à utiliser en PRIORITÉ ABSOLUE (expire dans <3 jours) :\n${urgent.join('\n')}\n\n`;
  if (normal.length) s += `✅ DISPONIBLE :\n${normal.join('\n')}`;
  return s;
}

// ─── Appel IA multi-provider ─────────────────

async function _callAI(prompt) {
  if (menuAI === 'anthropic') {
    if (!anthropicKey) throw new Error('Clé Anthropic non configurée dans Supabase (table config, clé : anthropic_key).');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || r.statusText);
    return j.content?.[0]?.text || '{}';
  }

  if (menuAI === 'openai') {
    if (!openaiKey) throw new Error('Clé OpenAI non configurée dans Supabase (table config, clé : openai_key).');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + openaiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || r.statusText);
    return j.choices?.[0]?.message?.content || '{}';
  }

  // Mistral (défaut)
  if (!mistralKey) throw new Error('Clé Mistral non configurée dans Supabase (table config, clé : mistral_key).');
  const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + mistralKey,
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.message || r.statusText);
  return j.choices?.[0]?.message?.content || '{}';
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
            <div class="meal-name">
              ${esc(m.dish || '')}
              ${m.uses_urgent ? '<span class="meal-urgent-badge">⚠️ anti-gaspi</span>' : ''}
            </div>
            ${m.prep_time_minutes ? `<div class="meal-prep-time">⏱ ${m.prep_time_minutes} min</div>` : ''}
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

// ─── Génération via IA ────────────────────────

async function generateMenus() {
  const all = [...appData.fridge, ...appData.freezer, ...appData.pantry];
  const resultEl  = document.getElementById('menu-result');
  const contentEl = document.getElementById('menu-result-content');

  if (!all.length) {
    resultEl.classList.add('show');
    contentEl.innerHTML = '<div style="color:var(--text-faint);">Stock vide !</div>';
    return;
  }

  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  btn.textContent = 'Génération en cours…';
  resultEl.classList.add('show');
  contentEl.innerHTML = Array(5).fill('<div class="skeleton-line"></div>').join('');

  const timeCfg = {
    rapide: { label: '20 minutes (cuisson incluse)', note: 'Exclus : rôtis, mijotés, marinades longues, pâte à lever.', max: 20 },
    normal: { label: '45 minutes (cuisson incluse)', note: '',                                                            max: 45 },
    mijote: { label: '1 heure ou plus',              note: 'Plats mijotés, rôtis, sauces longues bienvenus.',            max: 90 },
  };
  const time    = timeCfg[menuTime] || timeCfg.normal;
  const stock   = buildStockSummary();
  const mealsStr = [...menuMeals].join(' + ');
  const numDays  = menuBatch ? 3 : parseInt(menuDays);
  const persons  = menuPersons || '2';
  const menuExtra = document.getElementById('menu-extra').value.trim();

  const batchSection = menuBatch ? `
# MODE BATCH COOKING
- Tout préparer en une seule session (ex. dimanche).
- Chaque plat se conserve 2-3 jours au frigo — le mentionner dans la dernière étape.
- Réutiliser les mêmes ingrédients de base entre les plats pour minimiser les restes.
- Indiquer les quantités à préparer d'avance (ex : "Cuire 400 g de riz pour 3 jours").
` : '';

  const prompt = `# RÔLE
Tu es un chef cuisinier expérimenté spécialisé dans la cuisine du quotidien et la lutte anti-gaspillage. Ta mission : créer des menus réalistes, savoureux et adaptés au stock disponible, en évitant que des produits soient jetés.

# CONTEXTE
L'utilisateur gère son stock alimentaire via une application. Tu reçois son inventaire actuel et tu dois générer un menu qui maximise l'usage des produits proches de la péremption.
${menuExtra ? `\n⛔ ALLERGIES / INTERDICTIONS ABSOLUES : ${menuExtra}. Vérifie chaque plat proposé.\n` : ''}
# STOCK DISPONIBLE
Produits de base TOUJOURS autorisés (considère-les comme illimités) : sel, poivre, huile d'olive, eau.

${stock}

# CONTRAINTES (par ordre de priorité décroissante)

PRIORITÉ 1 — Sécurité alimentaire :
- N'utilise QUE les produits listés ci-dessus + les bases autorisées.
- Si un plat nécessite un ingrédient absent, choisis un AUTRE plat. Ne fais aucune substitution implicite.
- Ne mentionne JAMAIS un produit absent du stock dans stock_items.

PRIORITÉ 2 — Anti-gaspillage :
- Chaque produit URGENT doit apparaître dans au moins UN plat du menu.
- Épuise les produits urgents avant les disponibles si possible.

PRIORITÉ 3 — Paramètres du menu :
- Durée : ${numDays} jour(s)
- Repas : ${mealsStr}
- Personnes : ${persons} (adapte les quantités en conséquence)
- Régime : ${menuDiet}
- Temps de préparation MAX : ${time.label}. ${time.note}

PRIORITÉ 4 — Variété :
- Les repas d'une même journée doivent être DIFFÉRENTS (plats distincts, pas juste des variantes).
- Évite de répéter le même féculent deux fois de suite.
- Objectif : ${menuPrio}.
${batchSection}
# MÉTHODE (raisonne dans cet ordre, en silence)
1. Liste mentalement les produits urgents → ils DOIVENT être placés.
2. Imagine 2-3 plats possibles par repas en respectant le stock.
3. Vérifie pour chaque plat : temps ≤ ${time.max} min ? tous les ingrédients sont-ils dans le stock ?
4. Choisis la combinaison qui couvre le mieux les produits urgents.
5. Génère le JSON final.

# FORMAT DE SORTIE (JSON strict, AUCUN markdown, AUCUN texte avant/après)

{"days":[{"label":"Jour 1","meals":[{"type":"Déjeuner","dish":"Nom du plat (max 6 mots)","servings":${persons},"prep_time_minutes":15,"stock_items":["nom exact tel qu'écrit dans le stock"],"uses_urgent":true,"steps":["Étape 1 (verbe à l'infinitif).","Étape 2.","Étape 3."]}]}]}

# RÈGLES DES ÉTAPES
- 2 à 4 étapes maximum, 1 phrase chacune, à l'infinitif.
- Ultra-concrètes : températures (°C), durées (min), tailles de découpe.
- Si produit congelé : 1ʳᵉ étape = "Sortir [produit] du congélateur."
- Dernière étape = service/dressage${menuBatch ? ' ou "Conserver au frigo, réchauffer X min avant de servir."' : ''}.
- Pas de "selon votre goût" — sois précis.

# VÉRIFICATION FINALE (silencieuse avant de répondre)
☐ Tous les stock_items existent-ils dans le stock fourni ?
☐ Chaque produit URGENT est-il utilisé au moins une fois ?
☐ Chaque prep_time_minutes est-il ≤ ${time.max} ?
☐ JSON valide, aucun markdown, aucun texte hors JSON ?

Réponds UNIQUEMENT avec le JSON.`;

  const aiLabels = { mistral: 'Mistral AI', openai: 'ChatGPT (GPT-4o)', anthropic: 'Claude (Opus)' };

  try {
    const raw  = (await _callAI(prompt)).replace(/```json|```/g, '');
    const days = JSON.parse(raw).days || [];
    renderMenuDays(days, contentEl);

    if (days.length) {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:0.72rem;color:var(--text-faint);margin-top:12px;padding-top:12px;border-top:1px solid var(--border);';
      note.textContent = `✦ Menus générés par ${aiLabels[menuAI] || menuAI}`;
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
