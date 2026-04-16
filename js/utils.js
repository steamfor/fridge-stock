// ─────────────────────────────────────────────
// UTILITAIRES GÉNÉRAUX
// ─────────────────────────────────────────────

function showScreen(name) {
  ['setup', 'login', 'app'].forEach(s => {
    const el = document.getElementById('screen-' + s);
    if (el) el.classList.toggle('active', s === name);
  });
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(0,214,143,0.15)', 'border:1px solid rgba(0,214,143,0.4)',
      'color:#00d68f', 'padding:10px 20px', 'border-radius:99px',
      'font-family:var(--mono)', 'font-size:0.75rem', 'z-index:999',
      'transition:opacity 0.4s', 'white-space:nowrap',
      'backdrop-filter:blur(12px)', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

// Échappe les caractères HTML (protection XSS dans les templates string)
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Expiration ────────────────────────────────

// ─── Debounce ──────────────────────────────────

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ─── Sélects de catégories ────────────────────

function buildCategorySelect(id) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = '<option value="">Catégorie…</option>'
    + CATEGORIES.map(c => `<option>${c}</option>`).join('');
}

// ─── Raccourcis date ──────────────────────────

function setDateShortcut(inputId, days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  document.getElementById(inputId).value = d.toISOString().slice(0, 10);
}

function clearDateInput(inputId) {
  document.getElementById(inputId).value = '';
}

// ─── Expiration ────────────────────────────────

function expiryStatus(d) {
  if (!d) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((new Date(d) - today) / 86400000);
  return diff < 0 ? 'expired' : diff <= 3 ? 'warn' : 'ok';
}

function expiryLabel(d) {
  if (!d) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((new Date(d) - today) / 86400000);
  if (diff < 0)   return 'Expiré il y a ' + Math.abs(diff) + 'j';
  if (diff === 0) return "Expire aujourd'hui !";
  if (diff === 1) return 'Expire demain';
  if (diff <= 7)  return 'Dans ' + diff + 'j';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
