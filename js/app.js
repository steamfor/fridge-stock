// ─────────────────────────────────────────────
// POINT D'ENTRÉE — Settings, Raccourcis, Swipe
// ─────────────────────────────────────────────

function openSettings()       { document.getElementById('modal-settings').classList.add('open'); }
function closeSettings()      { document.getElementById('modal-settings').classList.remove('open'); }
function closeSettingsOnBg(e) { if (e.target === document.getElementById('modal-settings')) closeSettings(); }

// ─── Raccourcis clavier ───────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Enter'  && document.activeElement?.id === 'inp-name')       addItem();
  if (e.key === 'Enter'  && document.activeElement?.id === 'login-password') doLogin();
  if (e.key === 'Escape') { closeBarcode(); closeMenu(); closeSettings(); closeEdit(); }
});

// ─── Swipe-to-delete (délégation sur #list) ───

let _swipeItem  = null;
let _swipeX0    = 0;
let _swipeDx    = 0;

document.getElementById('list').addEventListener('touchstart', e => {
  const wrapper = e.target.closest('.item-wrapper');
  if (!wrapper) return;
  _swipeItem = wrapper.querySelector('.item');
  _swipeX0   = e.touches[0].clientX;
  _swipeDx   = 0;
  if (_swipeItem) _swipeItem.style.transition = 'none';
}, { passive: true });

document.getElementById('list').addEventListener('touchmove', e => {
  if (!_swipeItem) return;
  const dx = e.touches[0].clientX - _swipeX0;
  if (dx < 0) {
    _swipeDx = dx;
    _swipeItem.style.transform = `translateX(${Math.max(dx, -88)}px)`;
  }
}, { passive: true });

document.getElementById('list').addEventListener('touchend', () => {
  if (!_swipeItem) return;
  _swipeItem.style.transition = 'transform 0.22s ease';
  if (_swipeDx < -60) {
    _swipeItem.style.transform = 'translateX(-88px)';
    const wrapper = _swipeItem.closest('.item-wrapper');
    const id = wrapper?.dataset.id;
    if (id) {
      setTimeout(() => {
        _swipeItem.style.transform = 'translateX(-110%)';
        setTimeout(() => deleteItem(id), 220);
      }, 320);
    }
  } else {
    _swipeItem.style.transform = '';
  }
  _swipeItem = null;
}, { passive: true });

// ─── Initialisation des selects de catégories ─

['inp-cat', 'scan-cat', 'edit-cat'].forEach(id => buildCategorySelect(id));
updateNotifButton();

// ─── Service Worker ───────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ─── Lancement ────────────────────────────────

init();
