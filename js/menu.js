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

// ─── Catégorie nutritionnelle pour le prompt ──

function _itemPromptCategory(cat) {
  const map = {
    '🥩 Viande':            'PROTÉINE',
    '🐟 Poisson':           'PROTÉINE',
    '🍳 Œufs':              'PROTÉINE',
    '🥛 Laitier':           'LAITAGE',
    '🧀 Fromage':           'LAITAGE',
    '🥦 Légumes':           'LÉGUME_FRAIS',
    '🍎 Fruits':            'FRUIT',
    '🧃 Boissons':          null,
    '🍱 Plat préparé':      'PLAT_PRÉPARÉ_COMPLET',
    '🍝 Plats cuisinés':    'PLAT_PRÉPARÉ_COMPLET',
    '🍚 Féculents':         'FÉCULENT',
    '🍪 Biscuits & snacks': 'SNACK_DESSERT',
    '🫔 Condiments':        'SAUCE_CONDIMENT',
    '🍞 Boulangerie':       'FÉCULENT',
    '📦 Autre':             null,
  };
  return (cat && map[cat]) || null;
}

// ─── Résumé du stock pour le prompt ──────────

function buildStockSummary() {
  const locLabel = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' };
  const urgent = [], normal = [];
  ['fridge', 'freezer', 'pantry'].forEach(loc => {
    appData[loc].forEach(i => {
      const cat = _itemPromptCategory(i.cat);
      const catStr = cat ? ` — ${cat}` : '';
      const entry = `- ${i.name} : x${formatQty(i.qty)} [${locLabel[loc]}]${catStr}`;
      (['warn', 'expired'].includes(expiryStatus(i.exp)) ? urgent : normal).push(entry);
    });
  });
  if (!urgent.length && !normal.length) return null;
  let s = '';
  if (urgent.length) s += `⚠️ À consommer bientôt (< 3 jours) :\n${urgent.join('\n')}\n\n`;
  if (normal.length) s += `✅ DISPONIBLE :\n${normal.join('\n')}`;
  return s;
}

// ─── Appel IA multi-provider ─────────────

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
        temperature: 0.7,
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
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.message || r.statusText);
  return j.choices?.[0]?.message?.content || '{}';
}

// ─── Affichage des résultats ─────────────

function renderMenuDays(days, warnings, el) {
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

  if (warnings && warnings.length) {
    const warnDiv = document.createElement('div');
    warnDiv.className = 'menu-warnings';
    warnDiv.innerHTML = warnings.map(w => `<div class="menu-warning">⚠️ ${esc(w)}</div>`).join('');
    el.appendChild(warnDiv);
  }
}

// ─── Génération via IA ────────────────────

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
  const time      = timeCfg[menuTime] || timeCfg.normal;
  const stock     = buildStockSummary();
  const mealsStr  = [...menuMeals].join(' + ');
  const numDays   = menuBatch ? 3 : parseInt(menuDays);
  const persons   = menuPersons || '2';
  const menuExtra = document.getElementById('menu-extra').value.trim();
  const menuInspo = document.getElementById('menu-inspo').value.trim();

  const batchSection = menuBatch ? `
# MODE BATCH COOKING
- Tout préparer en une seule session (ex. dimanche).
- Chaque plat se conserve 2-3 jours au frigo — le mentionner dans la dernière étape.
- Réutiliser les mêmes ingrédients de base entre les plats pour minimiser les restes.
- Indiquer les quantités à préparer d'avance (ex : "Cuire 400 g de riz pour 3 jours").
` : '';

  const inspoSection = `# INSPIRATION CULINAIRE
Inspire-toi du style de Cyril Lignac (émission "Tous en cuisine") et de Philippe Etchebest (https://philippe-etchebest.com/recettes-mentor/) : recettes bistronomiques accessibles, techniques précises, cuisine française du quotidien généreuse et savoureuse.${menuInspo ? `\nL'utilisateur souhaite également s'inspirer de : ${menuInspo}` : ''}
Reflète ce style dans les noms de plats, les associations d'ingrédients et les techniques de cuisson — sans jamais inventer d'ingrédients absents du stock.

`;

  const prompt = `# RÔLE
Tu es un chef cuisinier français expérimenté, dans l'esprit de Cyril Lignac ou Philippe Etchebest, spécialisé dans la cuisine du quotidien savoureuse et accessible. Ta mission : créer des menus réalistes, variés et équilibrés à partir du stock disponible.

${inspoSection}# CONTEXTE
L'utilisateur gère son stock alimentaire via une application. Tu reçois son inventaire actuel (avec catégorie nutritionnelle de chaque produit) et tu dois générer un menu qui respecte les règles de composition d'un repas équilibré.
${menuExtra ? `\n⛔ ALLERGIES / INTERDICTIONS ABSOLUES : ${menuExtra}. Vérifie chaque plat proposé.\n` : ''}
# CATÉGORIES DE PRODUITS (à comprendre pour bien composer les repas)
- PROTÉINE : viande, poisson, œufs, légumineuses, tofu.
- FÉCULENT : pâtes, riz, pommes de terre, pain, semoule.
- LÉGUME_FRAIS : tomate, courgette, salade, carotte... (compte comme légume du repas).
- LÉGUMES_ACCOMPAGNEMENT : poêelées surgelées, ratatouille... (compte aussi comme légume).
- FRUIT : pour dessert ou collation.
- LAITAGE : yaourt, fromage, lait, beurre, crème.
- AROMATE : oignon, ail, herbes fraîches, gingembre. NE COMPTE PAS comme légume du repas — sert à parfumer.
- SAUCE_CONDIMENT : moutarde, sauce soja, vinaigre, pesto. Optionnel, ne structure pas un repas.
- PLAT_PRÉPARÉ_COMPLET : plats cuisinés autosuffisants (lasagnes, pizza, plat surgelé complet). Constitue À LUI SEUL le plat principal — ne pas inventer de recette autour.
- SNACK_DESSERT : biscuits, chocolat, gâteau.

# STOCK DISPONIBLE
Produits de base TOUJOURS disponibles (illimités) : sel, poivre, huile d'olive, eau, vinaigre, herbes sèches.

${stock}

# CONTRAINTES (par ordre de priorité décroissante)

PRIORITÉ 1 — Sécurité alimentaire :
- N'utilise QUE les produits listés ci-dessus + les bases autorisées.
- Si un plat nécessite un ingrédient absent, choisis un AUTRE plat. Aucune substitution implicite.

PRIORITÉ 2 — Objectif de l'utilisateur : ${menuPrio}.
- Si des produits sont marqués "⚠️ À consommer bientôt", intègre-les naturellement quand c'est savoureux — sans forcer des associations peu appétissantes.

PRIORITÉ 3 — Équilibre et composition du repas :
- Un repas équilibré contient idéalement : 1 PROTÉINE + 1 FÉCULENT + 1 LÉGUME (frais ou accompagnement).
- Les AROMATES ne comptent PAS comme légume du repas — ce sont des assaisonnements.
- Si un produit est PLAT_PRÉPARÉ_COMPLET, il constitue À LUI SEUL le plat principal :
  → N'invente PAS de recette autour, ne décris PAS comment cuisiner ses ingrédients internes.
  → Étapes limitées au mode de réchauffage ("Réchauffer selon les instructions du paquet.").
  → Tu peux l'accompagner d'une salade/crudité simple SI un LÉGUME_FRAIS est disponible.
  → Le champ \`dish\` reprend le nom du produit, sans réinventer.
- N'associe pas 2 PLAT_PRÉPARÉ_COMPLET dans le même repas.
- Si un élément clé manque pour un repas équilibré (ex. aucun féculent), signale-le dans \`warnings\` au lieu d'inventer.

PRIORITÉ 4 — Paramètres du menu :
- Durée : ${numDays} jour(s)
- Repas : ${mealsStr}
- Personnes : ${persons} (adapte les quantités proportionnellement)
- Régime : ${menuDiet}
- Temps de préparation MAX : ${time.label}. ${time.note}

PRIORITÉ 5 — Variété :
- Les repas d'une même journée doivent être DIFFÉRENTS (plats distincts).
- Sur plusieurs jours, varie féculents, protéines ET modes de cuisson (poêlé, gratiné, mijoté, cru…).
- Propose des plats originaux avec des noms évocateurs, pas des intitulés génériques.
${batchSection}
# MÉTHODE (raisonne dans cet ordre, en silence)
1. Détermine l'objectif (PRIORITÉ 2) et règle la créativité en conséquence.
2. Note les produits à consommer bientôt — intègre-les si c'est naturel et savoureux.
3. Pour chaque repas, sélectionne 1 PROTÉINE + 1 FÉCULENT + 1 LÉGUME (ou un PLAT_PRÉPARÉ_COMPLET).
4. Vérifie : temps ≤ ${time.max} min ? Tous les ingrédients dans le stock ?
5. Si un composant manque, ajoute une entrée dans \`warnings\`.
6. Gène le JSON final.

# FORMAT DE SORTIE (JSON strict, AUCUN markdown, AUCUN texte avant/après)

{"days":[{"label":"Jour 1","meals":[{"type":"Déjeuner","dish":"Nom du plat évocateur","servings":${persons},"prep_time_minutes":15,"stock_items":["nom exact tel qu'écrit dans le stock"],"uses_urgent":false,"steps":["Étape 1 (verbe à l'infinitif).","Étape 2.","Étape 3."]}]}],"warnings":[]}

# RÈGLES DES ÉTAPES
- 2 à 4 étapes maximum, 1 phrase chacune, à l'infinitif.
- Concrètes : températures (°C), durées (min), tailles de découpe.
- Produit congelé → 1ʳᵉ étape = "Sortir [produit] du congélateur." ou décongélation rapide.
- PLAT_PRÉPARÉ_COMPLET → étapes uniquement de réchauffage.
- Dernière étape = service ("Servir chaud", "Dresser dans une assiette").${menuBatch ? '\n- Dernière étape pour chaque plat = conservation frigo + temps de réchauffage.' : ''}

# EXEMPLES DE BONNES SORTIES

Exemple 1 — Repas équilibré classique :
{"days":[{"label":"Jour 1","meals":[{"type":"Déjeuner","dish":"Poulet poêelé aux tomates et riz","servings":2,"prep_time_minutes":18,"stock_items":["Poulet","Tomates","Riz"],"uses_urgent":false,"steps":["Cuire 160g de riz dans 320ml d'eau salée, 12 min à feu doux.","Couper le poulet en lamelles et faire revenir 6 min à l'huile d'olive.","Ajouter les tomates en quartiers, saler, poivrer, cuire 4 min.","Servir le poulet sur le riz."]}]}],"warnings":[]}

Exemple 2 — Avec plat préparé complet :
{"days":[{"label":"Jour 1","meals":[{"type":"Déjeuner","dish":"Linguine saumon épinards et salade de tomates","servings":2,"prep_time_minutes":10,"stock_items":["Linguine au saumon épinards sauce citron basilic","Tomates"],"uses_urgent":false,"steps":["Réchauffer le plat de linguine selon les instructions du paquet.","Couper les tomates en quartiers et les assaisonner avec sel, poivre et huile d'olive.","Servir la salade de tomates en accompagnement."]}]}],"warnings":[]}

Exemple 3 — Manque de féculent (warning) :
{"days":[{"label":"Jour 1","meals":[{"type":"Dîner","dish":"Omelette provençale aux tomates","servings":2,"prep_time_minutes":10,"stock_items":["Œufs","Tomates","Oignon"],"uses_urgent":false,"steps":["Émincer l'oignon et le faire suer 3 min à l'huile.","Ajouter les tomates en dés, cuire 2 min.","Battre 4 œufs, verser dans la poêle, cuire 4 min à feu moyen.","Servir chaud."]}]}],"warnings":["Aucun féculent disponible pour ce dîner — pensez à racheter du pain ou des pâtes."]}

# VÉRIFICATION FINALE (silencieuse, avant de répondre)
☐ Tous les \`stock_items\` existent-ils dans le stock fourni ?
☐ Chaque repas a-t-il une protéine + féculent + légume, OU un plat préparé complet, OU un warning ?
☐ Les plats sont-ils variés (pas de répétition de plat d'un jour à l'autre) ?
☐ Chaque \`prep_time_minutes\` ≤ ${time.max} ?
☐ JSON valide, aucun markdown, aucun texte hors JSON ?

Réponds UNIQUEMENT avec le JSON.`;

  const aiLabels = { mistral: 'Mistral AI', openai: 'ChatGPT (GPT-4o)', anthropic: 'Claude (Opus)' };

  try {
    const raw      = (await _callAI(prompt)).replace(/```json|```/g, '');
    const parsed   = JSON.parse(raw);
    const days     = parsed.days || [];
    const warnings = parsed.warnings || [];
    renderMenuDays(days, warnings, contentEl);

    if (days.length) {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:0.72rem;color:var(--text-faint);margin-top:12px;padding-top:12px;border-top:1px solid var(--border);';
      note.textContent = `❖ Menus générés par ${aiLabels[menuAI] || menuAI}`;
      contentEl.appendChild(note);
    }
  } catch (err) {
    contentEl.innerHTML = `<div style="color:var(--expired);font-size:0.83rem;">❌ ${esc(err.message)}</div>`;
  }

  btn.disabled = false;
  btn.innerHTML = '❖ &nbsp;Régénérer';
}

// ─── Ouverture / fermeture ────────────────────

function openMenu() {
  document.getElementById('modal-menu').classList.add('open');
  document.getElementById('menu-result').classList.remove('show');
  document.getElementById('menu-result-content').innerHTML = '';
  document.getElementById('btn-generate').disabled = false;
  document.getElementById('btn-generate').innerHTML = '❖ &nbsp;Générer les menus';
}

function closeMenu()      { document.getElementById('modal-menu').classList.remove('open'); }
function closeMenuOnBg(e) { if (e.target === document.getElementById('modal-menu')) closeMenu(); }
