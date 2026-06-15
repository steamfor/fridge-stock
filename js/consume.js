// ─────────────────────────────────────────────
// MODE CONSOMMATION RAPIDE
// Recherche + tap = −1 sur n'importe quel produit
// ─────────────────────────────────────────────

function openConsume() {
  document.getElementById('consume-search').value = '';
  renderConsumeList();
  document.getElementById('modal-consume').classList.add('open');
  setTimeout(() => document.getElementById('consume-search').focus(), 80);
}

function closeConsume() {
  document.getElementById('modal-consume').classList.remove('open');
}

function closeConsumeOnBg(e) {
  if (e.target === document.getElementById('modal-consume')) closeConsume();
}

function renderConsumeList() {
  const query   = document.getElementById('consume-search').value.toLowerCase().trim();
  const locIcon = { fridge: '🧊', freezer: '❄️', pantry: '🫙' };

  const all = [
    ...appData.fridge.map(i => ({ ...i, loc: 'fridge' })),
    ...appData.freezer.map(i => ({ ...i, loc: 'freezer' })),
    ...appData.pantry.map(i => ({ ...i, loc: 'pantry' })),
  ]
    .filter(i => !query || i.name.toLowerCase().includes(query) || (i.cat || '').toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const el = document.getElementById('consume-list');
  if (!all.length) {
    el.innerHTML = '<div class="consume-empty">Aucun produit trouvé.</div>';
    return;
  }

  el.innerHTML = all.map(i => `
    <button class="consume-item" onclick="consumeOne('${i.id}','${i.loc}')">
      <span class="consume-loc">${locIcon[i.loc]}</span>
      <span class="consume-name">${esc(i.name)}</span>
      <span class="consume-qty">${formatQty(i.qty)}</span>
      <span class="consume-minus">−1</span>
    </button>
  `).join('');
}

async function consumeOne(id, loc) {
  const item = appData[loc].find(i => i.id === id);
  if (!item) return;

  const newQty = item.qty - 1;
  const name   = item.name;

  if (newQty <= 0) {
    appData[loc] = appData[loc].filter(i => i.id !== id);
  } else {
    item.qty = newQty;
  }

  renderConsumeList();
  render();

  const { error } = newQty <= 0
    ? await sbClient.from('stock').delete().eq('id', id)
    : await sbClient.from('stock').update({ qty: newQty }).eq('id', id);

  if (error) { showToast('Erreur : ' + error.message); loadStock(); return; }
  showToast(newQty <= 0 ? `${name} — retiré ✓` : `${name} — ${formatQty(newQty)} restant ✓`);
}
