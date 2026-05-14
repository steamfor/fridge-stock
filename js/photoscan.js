// ─────────────────────────────────────────────
// SCAN PHOTO STOCK (Pixtral / Mistral vision)
// ─────────────────────────────────────────────

let _photoScanItems   = [];
let photoScanLocation = 'pantry';
let _photoScanStream  = null;

function openPhotoScan() {
  _photoScanItems   = [];
  photoScanLocation = 'pantry';
  document.getElementById('modal-photo-scan').classList.add('open');
  document.querySelectorAll('.photoscan-loc-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.loc === 'pantry')
  );
  document.getElementById('photoscan-preview-section').style.display = 'none';
  const thumb = document.getElementById('photoscan-thumb');
  thumb.src           = '';
  thumb.style.display = 'none';
  _setCameraMode(false);
  _setPhotoCaptureButtons(false, '');
}

function _setCameraMode(active) {
  document.getElementById('photoscan-capture-btns').style.display   = active ? 'none' : '';
  document.getElementById('photoscan-video').style.display           = active ? 'block' : 'none';
  document.getElementById('btn-photoscan-shutter').style.display     = active ? '' : 'none';
}

function _setPhotoCaptureButtons(disabled, statusText) {
  document.getElementById('btn-photoscan-camera').disabled  = disabled;
  document.getElementById('btn-photoscan-gallery').disabled = disabled;
  const status = document.getElementById('photoscan-status');
  status.style.display = statusText ? '' : 'none';
  status.textContent   = statusText;
}

function closePhotoScan() {
  _stopCamera();
  document.getElementById('modal-photo-scan').classList.remove('open');
}

function closePhotoScanOnBg(e) {
  if (e.target === document.getElementById('modal-photo-scan')) closePhotoScan();
}

function setPhotoScanLoc(loc) {
  photoScanLocation = loc;
  document.querySelectorAll('.photoscan-loc-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.loc === loc)
  );
}

// ─── Caméra live ───────────────────────────────

async function _startCamera() {
  if (!mistralKey) { showToast('Clé Mistral non configurée.'); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Caméra non disponible sur ce navigateur.');
    return;
  }
  try {
    _photoScanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
    });
    document.getElementById('photoscan-video').srcObject = _photoScanStream;
    _setCameraMode(true);
  } catch (err) {
    showToast("Impossible d'accéder à la caméra : " + err.message);
  }
}

function _stopCamera() {
  if (_photoScanStream) {
    _photoScanStream.getTracks().forEach(t => t.stop());
    _photoScanStream = null;
  }
  document.getElementById('photoscan-video').srcObject = null;
  _setCameraMode(false);
}

function _captureFromVideo() {
  const video  = document.getElementById('photoscan-video');
  const scale  = Math.min(1, 800 / Math.max(video.videoWidth || 1280, video.videoHeight || 960));
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round((video.videoWidth  || 1280) * scale);
  canvas.height = Math.round((video.videoHeight || 960)  * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  _stopCamera();
  canvas.toBlob(async (blob) => {
    const file  = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
    const thumb = document.getElementById('photoscan-thumb');
    thumb.src           = URL.createObjectURL(blob);
    thumb.style.display = 'block';
    await _analyzeShelfPhoto(file);
  }, 'image/jpeg', 0.75);
}

// ─── Déclenchement galerie ───────────────────────

function triggerPhotoCapture() {
  if (!mistralKey) { showToast('Clé Mistral non configurée.'); return; }
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const thumb = document.getElementById('photoscan-thumb');
    thumb.src           = URL.createObjectURL(file);
    thumb.style.display = 'block';
    await _analyzeShelfPhoto(file);
  };
  input.click();
}

// ─── Analyse Pixtral ──────────────────────────

async function _analyzeShelfPhoto(file) {
  _setPhotoCaptureButtons(true, 'Analyse en cours…');

  try {
    const base64   = await _resizeImageToBase64(file);
    const mimeType = 'image/jpeg';
    const catList  = CATEGORIES.filter(c => c !== '📦 Autre').join(', ');
    const prompt   = `Tu es un assistant spécialisé dans la reconnaissance de produits alimentaires en photo.\n\nExamine cette photo et liste uniquement les produits que tu identifies avec certitude.\n\nRéponds UNIQUEMENT avec ce JSON valide (sans markdown, sans explication) :\n{"items":[{"name":"Nom du produit","qty":1,"cat":"🍚 Féculents"}]}\n\nRègles STRICTES :\n- N'inclus un produit QUE si tu le vois clairement (emballage reconnaissable, forme identifiable avec certitude)\n- NE devine PAS et NE hallucine PAS — il vaut mieux en manquer que d'en inventer\n- Lis les étiquettes quand elles sont lisibles pour un nom précis (ex : "Yaourt Danone Nature" plutôt que "Yaourt")\n- Pour les produits frais sans étiquette : utilise une description simple (ex : "Carottes", "Pommes", "Steak haché")\n- qty = nombre d'unités clairement visibles du même produit (défaut 1)\n- Ignore les produits non alimentaires, ustensiles, emballages vides\n- cat = une de ces catégories exactes : ${catList} (ou "" si aucune ne correspond)`;

    const raw = await _callMistralVision(base64, mimeType, prompt);
    _photoScanItems = _parseAIFoodItems(raw);
    _renderPhotoScanPreview();
  } catch (err) {
    showToast('Erreur analyse : ' + err.message);
  }

  _setPhotoCaptureButtons(false, '');
}

// ─── Prévisualisation ─────────────────────────

function _renderPhotoScanPreview() {
  const section    = document.getElementById('photoscan-preview-section');
  const preview    = document.getElementById('photoscan-preview');
  const confirmBtn = document.getElementById('btn-photoscan-confirm');
  section.style.display = '';

  if (!_photoScanItems.length) {
    preview.innerHTML        = '<div style="color:var(--text-faint);font-size:0.83rem;padding:8px 0;">Aucun produit détecté. Réessayez avec une photo plus nette.</div>';
    confirmBtn.style.display = 'none';
    return;
  }

  preview.innerHTML    = _renderFoodItemRows(_photoScanItems, '_photoScanItems', '_removePhotoScanItem');
  confirmBtn.style.display = '';
}

function _removePhotoScanItem(i) {
  _photoScanItems.splice(i, 1);
  _renderPhotoScanPreview();
}

// ─── Import en masse ──────────────────────────

async function confirmPhotoScanImport() {
  const items = _photoScanItems.filter(i => i.name);
  if (!items.length) { showToast('Aucun produit à ajouter.'); return; }

  const btn = document.getElementById('btn-photoscan-confirm');
  btn.disabled    = true;
  btn.textContent = 'Ajout en cours…';

  let errors = 0;
  for (const item of items) {
    const err = await _upsertItem({ name: item.name, qty: item.qty, cat: item.cat || '', exp: null, location: photoScanLocation });
    if (err) errors++;
  }

  btn.disabled = false;
  if (errors) {
    showToast(`${errors} erreur(s) lors de l'ajout.`);
    btn.textContent = '＋ Réessayer';
  } else {
    showToast(`${items.length} produit(s) ajouté(s) ✓`);
    switchTab(photoScanLocation);
    closePhotoScan();
  }
}