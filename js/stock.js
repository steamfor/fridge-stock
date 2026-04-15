// ─────────────────────────────────────────────
// GESTION DU STOCK (CRUD + Import/Export)
// ─────────────────────────────────────────────

// ─── Chargement ───────────────────────────────

async function loadStock() {
  const { data, error } = await sbClient.from('stock').select('*').order('added', { ascending: true });
  if (error) { showToast('Erreur : ' + error.message); return; }
  appData.fridge  = (data || []).filter(r => r.location === 'fridge').map(dbToItem);
  appData.freezer = (data || []).filter(r => r.location === 'freezer').map(dbToItem);
  render();
}

function dbToItem(r) {
  return {
    id:    r.id,
    name:  r.name,
    qty:   r.qty,
    cat:   r.cat   || '',
    exp:   r.exp   || '',
    added: r.added || Date.now(),
  };
}

function subscribeRealtime() {
  if (realtimeSub) sbClient.removeChannel(realtimeSub);
  realtimeSub = sbClient
    .channel('stock-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => loadStock())
    .subscribe();
}

// ─── Ajout (formulaire principal) ────────────

async function addItem() {
  const name = document.getElementById('inp-name').value.trim();
  if (!name) { document.getElementById('inp-name').focus(); return; }

  const qty = parseInt(document.getElementById('inp-qty').value) || 1;
  const cat = document.getElementById('inp-cat').value;
  const exp = document.getElementById('inp-exp').value || null;

  const error = await _upsertItem({ name, qty, cat, exp, location: currentTab });
  if (error) { showToast('Erreur : ' + error.message); return; }

  document.getElementById('inp-name').value = '';
  document.getElementById('inp-exp').value  = '';
  document.getElementById('inp-qty').value  = 1;
  document.getElementById('inp-cat').value  = '';
  document.getElementById('inp-name').focus();
}

// ─── Ajout depuis le scanner ──────────────────

async function addFromScan() {
  const { name, qty, cat, exp } = _getScanFormValues();
  if (!name) { document.getElementById('scan-name').focus(); return; }

  const error = await _upsertItem({ name, qty, cat, exp, location: scanLocation });
  if (error) { showToast('Erreur : ' + error.message); return; }
  closeBarcode();
}

async function addFromScanAndContinue() {
  const { name, qty, cat, exp } = _getScanFormValues();
  if (!name) { document.getElementById('scan-name').focus(); return; }

  const error = await _upsertItem({ name, qty, cat, exp, location: scanLocation });
  if (error) { showToast('Erreur : ' + error.message); return; }

  showToast('Ajouté ✓');
  // Réinitialiser le formulaire et relancer le scanner
  document.getElementById('scan-result-form').style.display = 'none';
  const ind = document.getElementById('scan-indicator');
  ind.className = 'scan-indicator loading';
  ind.innerHTML = '<span class="pulse">●</span>&nbsp;Cherche un code-barres…';
  lastScannedCode = null;
  startDecoding(document.getElementById('camera-view'));
}

function _getScanFormValues() {
  return {
    name: document.getElementById('scan-name').value.trim(),
    qty:  parseInt(document.getElementById('scan-qty').value) || 1,
    cat:  document.getElementById('scan-cat').value,
    exp:  document.getElementById('scan-exp').value || null,
  };
}

// ─── Upsert : incrémente si le nom existe déjà ─

async function _upsertItem({ name, qty, cat, exp, location }) {
  const existing = appData[location].find(i => i.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    const { error } = await sbClient.from('stock').update({ qty: existing.qty + qty }).eq('id', existing.id);
    return error;
  }
  const { error } = await sbClient.from('stock').insert({ name, qty, cat, exp, location, added: Date.now() });
  return error;
}

// ─── Modification de quantité ─────────────────

async function changeQty(id, delta) {
  const item = appData[currentTab].find(i => i.id === id);
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    await sbClient.from('stock').delete().eq('id', id);
  } else {
    await sbClient.from('stock').update({ qty: newQty }).eq('id', id);
  }
}

// ─── Suppression ──────────────────────────────

async function deleteItem(id) {
  await sbClient.from('stock').delete().eq('id', id);
}

// ─── Déplacement frigo ↔ congélateur ─────────

async function moveItem(id) {
  const inFridge = !!appData.fridge.find(i => i.id === id);
  const to = inFridge ? 'freezer' : 'fridge';
  const { error } = await sbClient.from('stock').update({ location: to }).eq('id', id);
  if (error) { showToast('Erreur : ' + error.message); return; }
  showToast('Déplacé vers ' + (to === 'fridge' ? '🧊 Frigo' : '❄️ Congél.') + ' ✓');
}

// ─── Location scanner ─────────────────────────

function setScanLocation(loc) {
  scanLocation = loc;
  document.querySelectorAll('.loc-btn').forEach(b => b.classList.toggle('active', b.dataset.loc === loc));
}

// ─── Import / Export ──────────────────────────

function exportData() {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fridgestock-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}

async function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.fridge && !imported.freezer) throw new Error('Format invalide');

        await sbClient.from('stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const rows = [
          ...(imported.fridge  || []).map(i => ({ name: i.name, qty: i.qty, cat: i.cat || '', exp: i.exp || null, location: 'fridge',  added: i.added || Date.now() })),
          ...(imported.freezer || []).map(i => ({ name: i.name, qty: i.qty, cat: i.cat || '', exp: i.exp || null, location: 'freezer', added: i.added || Date.now() })),
        ];
        if (rows.length) await sbClient.from('stock').insert(rows);

        closeSettings();
        showToast('Données importées ✓');
      } catch (err) {
        alert('Erreur : ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

async function confirmClear() {
  if (confirm('Effacer TOUT le stock ? Action irréversible.')) {
    await sbClient.from('stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    closeSettings();
  }
}
