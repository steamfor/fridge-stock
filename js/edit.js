// ─────────────────────────────────────────────
// ÉDITION D'UN ALIMENT
// Tap sur le nom d'un item → modale pré-remplie
// ─────────────────────────────────────────────

function openEdit(id) {
  const item = [...appData.fridge, ...appData.freezer].find(i => i.id === id);
  if (!item) return;

  editingId = id;
  document.getElementById('edit-name').value = item.name;
  document.getElementById('edit-qty').value  = item.qty;
  document.getElementById('edit-cat').value  = item.cat || '';
  document.getElementById('edit-exp').value  = item.exp || '';
  document.getElementById('modal-edit').classList.add('open');

  // Sélectionner le nom pour édition rapide
  setTimeout(() => document.getElementById('edit-name').select(), 50);
}

async function saveEdit() {
  if (!editingId) return;

  const name = document.getElementById('edit-name').value.trim();
  if (!name) { document.getElementById('edit-name').focus(); return; }

  const qty = parseInt(document.getElementById('edit-qty').value) || 1;
  const cat = document.getElementById('edit-cat').value;
  const exp = document.getElementById('edit-exp').value || null;

  const { error } = await sbClient.from('stock').update({ name, qty, cat, exp }).eq('id', editingId);
  if (error) { showToast('Erreur : ' + error.message); return; }

  closeEdit();
  showToast('Modifié ✓');
}

function closeEdit() {
  document.getElementById('modal-edit').classList.remove('open');
  editingId = null;
}

function closeEditOnBg(e) {
  if (e.target === document.getElementById('modal-edit')) closeEdit();
}
