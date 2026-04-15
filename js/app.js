// ─────────────────────────────────────────────
// POINT D'ENTRÉE — Settings & Raccourcis clavier
// ─────────────────────────────────────────────

function openSettings()       { document.getElementById('modal-settings').classList.add('open'); }
function closeSettings()      { document.getElementById('modal-settings').classList.remove('open'); }
function closeSettingsOnBg(e) { if (e.target === document.getElementById('modal-settings')) closeSettings(); }

document.addEventListener('keydown', e => {
  if (e.key === 'Enter'  && document.activeElement?.id === 'inp-name')       addItem();
  if (e.key === 'Enter'  && document.activeElement?.id === 'login-password') doLogin();
  if (e.key === 'Escape') { closeBarcode(); closeMenu(); closeSettings(); }
});

// Lancement
init();
