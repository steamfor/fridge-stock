// ─────────────────────────────────────────────
// NOTIFICATIONS D'EXPIRATION
// ─────────────────────────────────────────────

async function requestNotifications() {
  if (!('Notification' in window)) { showToast('Notifications non supportées.'); return; }
  const perm = await Notification.requestPermission();
  updateNotifButton();
  if (perm === 'granted') {
    showToast('Notifications activées ✓');
    checkExpiryNotifications(true);
  } else {
    showToast('Permission refusée.');
  }
}

function checkExpiryNotifications(force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const key = 'notif-last-' + new Date().toISOString().slice(0, 10);
  if (!force && localStorage.getItem(key)) return;

  const allItems = [...appData.fridge, ...appData.freezer, ...appData.pantry];
  const expiring = allItems.filter(i => ['warn', 'expired'].includes(expiryStatus(i.exp)));
  if (!expiring.length) return;

  localStorage.setItem(key, '1');

  const expired = expiring.filter(i => expiryStatus(i.exp) === 'expired');
  const warning = expiring.filter(i => expiryStatus(i.exp) === 'warn');

  let body = '';
  if (expired.length) body += expired.map(i => i.name).join(', ') + ' expiré(s). ';
  if (warning.length) body += warning.map(i => i.name).join(', ') + ' expire bientôt.';

  new Notification('FridgeStock — Attention', { body, icon: '/icon-192.png' });
}

function updateNotifButton() {
  const btn = document.getElementById('btn-notif');
  if (!btn) return;
  if (!('Notification' in window)) { btn.style.display = 'none'; return; }
  const perm = Notification.permission;
  if (perm === 'granted') {
    btn.textContent = '🔔 Notifications actives';
    btn.className = 'btn-ok-sm';
  } else {
    btn.textContent = '🔕 Activer les notifications';
    btn.className = 'btn-secondary';
  }
}
