// ─────────────────────────────────────────────
// IMPORT TICKET DE CAISSE (Mistral AI)
// ─────────────────────────────────────────────

let receiptLocation     = 'freezer';
let _parsedReceiptItems = [];

function openReceipt() {
  receiptLocation     = 'freezer';
  _parsedReceiptItems = [];
  document.getElementById('modal-receipt').classList.add('open');
  document.querySelectorAll('.receipt-loc-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.loc === 'freezer')
  );
  document.getElementById('receipt-text').value        = '';
  document.getElementById('receipt-preview-section').style.display = 'none';
  const parseBtn = document.getElementById('btn-receipt-parse');
  parseBtn.disabled    = false;
  parseBtn.textContent = '🔍 Analyser le texte';
}

function closeReceipt() {
  document.getElementById('modal-receipt').classList.remove('open');
}

function closeReceiptOnBg(e) {
  if (e.target === document.getElementById('modal-receipt')) closeReceipt();
}

function setReceiptLocation(loc) {
  receiptLocation = loc;
  document.querySelectorAll('.receipt-loc-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.loc === loc)
  );
}

// ─── Import PDF ─────────────────────────────

function receiptImportPdf() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.pdf,application/pdf';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const parseBtn = document.getElementById('btn-receipt-parse');
    parseBtn.disabled    = true;
    parseBtn.textContent = 'Lecture du PDF…';
    try {
      const text = await _extractPdfText(file);
      document.getElementById('receipt-text').value = text;
      showToast('PDF chargé ✓');
    } catch (err) {
      showToast('Erreur PDF : ' + err.message);
    }
    parseBtn.disabled    = false;
    parseBtn.textContent = '🔍 Analyser le texte';
  };
  input.click();
}

async function _extractPdfText(file) {
  await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text.trim();
}

// ─── Photo / OCR ──────────────────────────────

function receiptScanPhoto() {
  if (!mistralKey) { showToast('Clé Mistral non configurée.'); return; }
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await _ocrReceiptImage(file);
  };
  input.click();
}

async function _ocrReceiptImage(file) {
  const parseBtn = document.getElementById('btn-receipt-parse');
  parseBtn.disabled    = true;
  parseBtn.textContent = "Lecture de l'image…";

  try {
    const base64   = await _resizeImageToBase64(file);
    const mimeType = 'image/jpeg';
    const catList  = CATEGORIES.filter(c => c !== '📦 Autre').join(', ');
    const prompt   = `Extrait les articles alimentaires de ce ticket de caisse.\n\nRéponds UNIQUEMENT avec ce JSON valide (sans markdown):\n{"items":[{"name":"Nom du produit","qty":1,"cat":"🍱 Plat préparé"}]}\n\nRègles:\n- Produits alimentaires uniquement (pas sacs, cartes, etc.)\n- Ignore totaux, taxes, remises, codes articles\n- qty = quantité entière ≥ 1 (défaut 1)\n- Noms lisibles, sans codes internes\n- cat = une de ces catégories exactes : ${catList} (ou "" si aucune)`;

    const raw = await _callMistralVision(base64, mimeType, prompt);
    _parsedReceiptItems = _parseAIFoodItems(raw);
    document.getElementById('receipt-preview-section').style.display = '';
    renderReceiptPreview();
  } catch (err) {
    showToast('Erreur OCR : ' + err.message);
  }

  parseBtn.disabled    = false;
  parseBtn.textContent = '🔍 Analyser le texte';
}

// ─── Parsing texte via Mistral ────────────────────

async function parseReceipt() {
  const text = document.getElementById('receipt-text').value.trim();
  if (!text) { showToast('Collez le texte du ticket.'); return; }
  if (!mistralKey) { showToast('Clé Mistral non configurée.'); return; }

  const btn = document.getElementById('btn-receipt-parse');
  btn.disabled    = true;
  btn.textContent = 'Analyse en cours…';

  const catList = CATEGORIES.filter(c => c !== '📦 Autre').join(', ');
  const prompt  = `Extrait les articles alimentaires d'un ticket de caisse français.\n\nTicket:\n${text}\n\nRéponds UNIQUEMENT avec ce JSON valide (sans markdown, sans explication):\n{"items":[{"name":"Nom du produit","qty":1,"cat":"🍱 Plat préparé"}]}\n\nRègles strictes:\n- Ne garde que les produits alimentaires (pas les sacs, emballages, cartes cadeaux, etc.)\n- Ignore les totaux, taxes, remises, codes articles, numéros\n- qty = quantité achetée (entier ≥ 1, défaut 1 si non précisé)\n- Simplifie et nettoie les noms (lisibles, sans codes internes)\n- Si le même produit apparaît plusieurs fois, somme les quantités\n- cat = une de ces catégories exactes : ${catList} (ou "" si aucune ne correspond)`;

  try {
    const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + mistralKey,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.message || r.statusText);
    _parsedReceiptItems = _parseAIFoodItems(j.choices?.[0]?.message?.content || '{}');
    renderReceiptPreview();
  } catch (err) {
    showToast('Erreur : ' + err.message);
    btn.disabled    = false;
    btn.textContent = '🔍 Analyser le texte';
    return;
  }

  btn.disabled    = false;
  btn.textContent = '🔍 Analyser à nouveau';
}

// ─── Prévisualisation ───────────────────────────

function renderReceiptPreview() {
  const section    = document.getElementById('receipt-preview-section');
  const preview    = document.getElementById('receipt-preview');
  const confirmBtn = document.getElementById('btn-receipt-confirm');
  section.style.display = '';

  if (!_parsedReceiptItems.length) {
    preview.innerHTML        = '<div style="color:var(--text-faint);font-size:0.83rem;padding:8px 0;">Aucun produit trouvé.</div>';
    confirmBtn.style.display = 'none';
    return;
  }

  preview.innerHTML    = _renderFoodItemRows(_parsedReceiptItems, '_parsedReceiptItems', '_removeReceiptItem');
  confirmBtn.style.display = '';
}

function _removeReceiptItem(i) {
  _parsedReceiptItems.splice(i, 1);
  renderReceiptPreview();
}

// ─── Import en masse ───────────────────────────

async function confirmReceiptImport() {
  const items = _parsedReceiptItems.filter(i => i.name);
  if (!items.length) { showToast('Aucun produit à ajouter.'); return; }

  const btn = document.getElementById('btn-receipt-confirm');
  btn.disabled    = true;
  btn.textContent = 'Ajout en cours…';

  let errors = 0;
  for (const item of items) {
    const err = await _upsertItem({ name: item.name, qty: item.qty, cat: item.cat || '', exp: null, location: receiptLocation });
    if (err) errors++;
  }

  btn.disabled = false;
  if (errors) {
    showToast(`${errors} erreur(s) lors de l'ajout.`);
    btn.textContent = '＋ Réessayer';
  } else {
    showToast(`${items.length} produit(s) ajouté(s) ✓`);
    switchTab(receiptLocation);
    closeReceipt();
  }
}

// ─── Utilitaires ───────────────────────────────

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s    = document.createElement('script');
    s.src      = src;
    s.onload   = resolve;
    s.onerror  = () => reject(new Error('Impossible de charger ' + src));
    document.head.appendChild(s);
  });
}