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
    const video = document.getElementById('photoscan-video');
    video.srcObject = _photoScanStream;
    _setCameraMode(true);
  } catch (err) {
    showToast('Impossible d\'accéder à la caméra : ' + err.message);
  }
}

function _stopCamera() {
  if (_photoScanStream) {
    _photoScanStream.getTracks().forEach(t => t.stop());
    _photoScanStream = null;
  }
  const video = document.getElementById('photoscan-video');
  video.srcObject = null;
  _setCameraMode(false);
}

function _captureFromVideo() {
  const video  = document.getElementById('photoscan-video');
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth  || 1280;
  canvas.height = video.videoHeight || 960;
  canvas.getContext('2d').drawImage(video, 0, 0);
  _stopCamera();
  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
    const thumb = document.getElementById('photoscan-thumb');
    thumb.src           = URL.createObjectURL(blob);
    thumb.style.display = 'block';
    await _analyzeShelfPhoto(file);
  }, 'image/jpeg', 0.92);
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
    const base64   = await _fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';
    const catList  = CATEGORIES.filter(c => c !== '📦 Autre').join(', ');

    const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + mistralKey,
      },
      body: JSON.stringify({
        model: 'pixtral-12b-2409',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Tu es un assistant qui identifie les produits alimentaires dans une photo de réfrigérateur, congélateur ou placard.\n\nExamine attentivement cette photo et liste TOUS les produits alimentaires visibles.\n\nRéponds UNIQUEMENT avec ce JSON valide (sans markdown, sans explication) :\n{"items":[{"name":"Nom du produit","qty":1,"cat":"🍚 Féculents"}]}\n\nRègles :\n- Identifie TOUS les produits visibles, même partiellement (boîtes, paquets, bouteilles, conserves, légumes, fruits, etc.)\n- qty = nombre d'unités visibles du même produit (défaut 1)\n- Noms simples et lisibles en français (ex : "Pâtes fusilli", "Sauce tomate", "Yaourt nature")\n- Ignore les produits non alimentaires (produits ménagers, emballages vides, etc.)\n- cat = une de ces catégories exactes : ${catList} (ou "" si aucune ne correspond)`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        }],
        temperature: 0.1,
        max_tokens:  2000,
      }),
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j?.message || r.statusText);

    const raw  = (j.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error('Réponse inattendue de l\'IA');

    _photoScanItems = (JSON.parse(json).items || [])
      .map(i => {
        const name = String(i.name || '').trim();
        const cat  = CATEGORIES.includes(i.cat) ? i.cat : guessCategoryFromName(name);
        return { name, qty: Math.max(1, parseInt(i.qty) || 1), cat };
      })
      .filter(i => i.name);

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

  preview.innerHTML = _photoScanItems.map((item, i) => `
    <div class="receipt-item-row">
      <input type="text" class="receipt-item-name" value="${esc(item.name)}"
        onchange="_photoScanItems[${i}].name = this.value.trim()"
        placeholder="Nom du produit">
      <input type="number" class="receipt-item-qty" value="${item.qty}" min="1" max="99"
        onchange="_photoScanItems[${i}].qty = Math.max(1, parseInt(this.value) || 1)">
      <select class="receipt-item-cat" onchange="_photoScanItems[${i}].cat = this.value">
        <option value="">📦 Autre</option>
        ${CATEGORIES.filter(c => c !== '📦 Autre').map(c =>
          `<option value="${c}"${item.cat === c ? ' selected' : ''}>${esc(c)}</option>`
        ).join('')}
      </select>
      <button class="receipt-item-del" onclick="_removePhotoScanItem(${i})" title="Supprimer">✕</button>
    </div>`).join('');

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
