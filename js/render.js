// ─────────────────────────────────────────────
// RENDU DE L'INTERFACE
// ─────────────────────────────────────────────

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('search').value = '';
  render();
}

function setSort(s) {
  currentSort = s;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === s));
  render();
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (currentSort === 'name')   return a.name.localeCompare(b.name, 'fr');
    if (currentSort === 'cat')    return (a.cat || '').localeCompare(b.cat || '', 'fr');
    if (currentSort === 'added')  return b.added - a.added;
    if (currentSort === 'expiry') {
      if (!a.exp && !b.exp) return 0;
      if (!a.exp) return 1;
      if (!b.exp) return -1;
      return a.exp.localeCompare(b.exp);
    }
    return 0;
  });
}

// ─── Skeleton (chargement initial) ───────────

function showSkeleton() {
  const listEl = document.getElementById('list');
  if (!listEl) return;
  listEl.innerHTML = [1, 2, 3, 4].map(() => `
    <div class="item-skeleton">
      <div style="flex:1;min-width:0">
        <div class="skeleton-line" style="width:55%;height:14px;margin-bottom:8px;"></div>
        <div class="skeleton-line" style="width:30%;height:10px;margin-bottom:0;"></div>
      </div>
      <div class="skeleton-line" style="width:90px;height:32px;border-radius:99px;margin:0;flex-shrink:0;"></div>
    </div>`).join('');
}

// ─── Rendu principal ──────────────────────────

function render() {
  const listEl = document.getElementById('list');
  if (!listEl) return;

  const query = document.getElementById('search').value.toLowerCase();
  let items = appData[currentTab];
  if (query) {
    items = items.filter(i =>
      i.name.toLowerCase().includes(query) || (i.cat || '').toLowerCase().includes(query)
    );
  }
  items = sortItems(items);

  // Compteurs des onglets
  document.getElementById('count-fridge').textContent  = appData.fridge.length;
  document.getElementById('count-freezer').textContent = appData.freezer.length;

  // Barre flottante
  const total = appData[currentTab].reduce((s, i) => s + i.qty, 0);
  const warns = appData[currentTab].filter(i => ['warn', 'expired'].includes(expiryStatus(i.exp))).length;
  document.getElementById('bar-total').textContent = total;
  const barWarn = document.getElementById('bar-warn');
  if (warns > 0) {
    barWarn.style.display = '';
    document.getElementById('bar-warn-count').textContent = warns;
  } else {
    barWarn.style.display = 'none';
  }

  // État vide
  if (!items.length) {
    const icon = currentTab === 'fridge' ? '🧊' : '❄️';
    const msg  = query ? 'Aucun résultat.' : 'Rien ici pour l\'instant.<br>Ajoutez vos premiers produits !';
    listEl.innerHTML = `<div class="empty-state"><span class="icon">${icon}</span>${msg}</div>`;
    return;
  }

  // Rendu par catégorie
  if (currentSort === 'cat') {
    const groups = {};
    items.forEach(i => {
      const k = i.cat || '📦 Autre';
      if (!groups[k]) groups[k] = [];
      groups[k].push(i);
    });
    listEl.innerHTML = Object.entries(groups)
      .map(([cat, catItems]) =>
        `<div class="section-label">${cat}</div>` + catItems.map(itemHTML).join('')
      ).join('');
  } else {
    listEl.innerHTML = items.map(itemHTML).join('');
  }
}

function itemHTML(item) {
  const status    = item.exp ? expiryStatus(item.exp) : 'none';
  const statusCls = status === 'none' ? 'no-expiry' : 'status-' + status;
  const moveTo    = currentTab === 'fridge' ? '❄️' : '🧊';
  const moveTitle = currentTab === 'fridge' ? 'Déplacer au congélateur' : 'Déplacer au frigo';

  return `
    <div class="item-wrapper" data-id="${item.id}">
      <div class="swipe-delete-bg" onclick="deleteItem('${item.id}')">🗑</div>
      <div class="item ${statusCls}">
        <div class="item-info" onclick="openEdit('${item.id}')">
          <div class="item-name">${esc(item.name)}</div>
          <div class="item-sub">
            ${item.cat ? `<span class="cat-tag">${esc(item.cat)}</span>` : ''}
            <span class="item-expiry">${expiryLabel(item.exp) || '—'}</span>
          </div>
        </div>
        <button class="btn-move" onclick="moveItem('${item.id}')" title="${moveTitle}">${moveTo}</button>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}',+1)">＋</button>
          <button class="qty-btn delete" onclick="deleteItem('${item.id}')">✕</button>
        </div>
      </div>
    </div>`;
}

// Recherche avec debounce (150 ms)
const debouncedRender = debounce(render, 150);
