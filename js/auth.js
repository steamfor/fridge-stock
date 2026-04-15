// ─────────────────────────────────────────────
// AUTHENTIFICATION & INITIALISATION
// ─────────────────────────────────────────────

async function init() {
  const url = localStorage.getItem('fs_sb_url');
  const key = localStorage.getItem('fs_sb_key');

  if (!url || !key) {
    showScreen('setup');
    return;
  }

  sbClient = supabase.createClient(url, key);

  if (localStorage.getItem('fs_auth') === 'ok') {
    enterApp();
  } else {
    showScreen('login');
    setTimeout(() => document.getElementById('login-password')?.focus(), 100);
  }
}

// ─── Setup (1er lancement) ────────────────────

function saveSetup() {
  const url = document.getElementById('setup-url').value.trim();
  const key = document.getElementById('setup-key').value.trim();
  const err = document.getElementById('setup-error');
  err.classList.remove('show');

  if (!url || !key) {
    err.textContent = 'Remplissez les deux champs.';
    err.classList.add('show');
    return;
  }

  localStorage.setItem('fs_sb_url', url);
  localStorage.setItem('fs_sb_key', key);
  sbClient = supabase.createClient(url, key);
  showScreen('login');
  setTimeout(() => document.getElementById('login-password')?.focus(), 100);
}

function resetSetup() {
  localStorage.removeItem('fs_sb_url');
  localStorage.removeItem('fs_sb_key');
  localStorage.removeItem('fs_auth');
  showScreen('setup');
}

// ─── Login ────────────────────────────────────

async function doLogin() {
  const pwd = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  err.classList.remove('show');

  if (!pwd) {
    err.textContent = 'Entrez le mot de passe.';
    err.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Vérification…';

  try {
    const { data, error } = await sbClient
      .from('config')
      .select('value')
      .eq('key', 'app_password')
      .single();

    if (error || !data) throw new Error('Impossible de vérifier le mot de passe.');

    if (pwd !== data.value) {
      err.textContent = 'Mot de passe incorrect.';
      err.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Entrer';
      return;
    }

    localStorage.setItem('fs_auth', 'ok');
    document.getElementById('login-password').value = '';
    btn.disabled = false;
    btn.textContent = 'Entrer';
    enterApp();
  } catch (e) {
    err.textContent = e.message;
    err.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Entrer';
  }
}

function togglePwd() {
  const inp = document.getElementById('login-password');
  const eye = document.getElementById('pwd-eye');
  if (inp.type === 'password') {
    inp.type = 'text';
    eye.textContent = '🙈';
  } else {
    inp.type = 'password';
    eye.textContent = '👁';
  }
}

// ─── Entrée dans l'app ────────────────────────

function enterApp() {
  document.getElementById('settings-email').textContent = 'FridgeStock — accès famille';
  showScreen('app');
  loadStock();
  subscribeRealtime();
  // Charger la clé Mistral depuis la BDD
  sbClient.from('config').select('value').eq('key', 'mistral_key').single()
    .then(({ data }) => { if (data) mistralKey = data.value; });
}

function doLogout() {
  if (realtimeSub) sbClient.removeChannel(realtimeSub);
  localStorage.removeItem('fs_auth');
  appData = { fridge: [], freezer: [] };
  mistralKey = '';
  closeSettings();
  showScreen('login');
  setTimeout(() => document.getElementById('login-password')?.focus(), 100);
}
