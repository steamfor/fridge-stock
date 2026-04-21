// ─────────────────────────────────────────────
// IMPORT TICKET DE CAISSE (Mistral AI)
// ─────────────────────────────────────────────

// Clés ASCII envoyées à Mistral → labels affichés dans l'app
const _CAT_KEYS = {
  'viande':          '🥩 Viande',
  'poisson':         '🐟 Poisson',
  'laitier':         '🥛 Laitier',
  'fromage':         '🧀 Fromage',
  'legumes':         '🥦 Légumes',
  'fruits':          '🍎 Fruits',
  'oeufs':           '🍳 Œufs',
  'boissons':        '🧃 Boissons',
  'plat-prepare':    '🍱 Plat préparé',
  'plats-cuisines':  '🍝 Plats cuisinés',
  'feculents':       '🍚 Féculents',
  'biscuits-snacks': '🍪 Biscuits & snacks',
  'condiments':      '🫙 Condiments',
  'boulangerie':     '🍞 Boulangerie',
};
const _CAT_KEYS_LIST = Object.keys(_CAT_KEYS).join(', ');

function _resolveCategory(key, name) {
  return _CAT_KEYS[key] || guessCategoryFromName(name) || '';
}

let receiptLocation     = 'freezer';
let _parsedReceiptItems = [];

function openReceipt() {
  receiptLocation     = 'freezer';
  _parsedReceiptItems = [];
  document.getElementById('modal-receipt').classList.add('open');
  document.querySelectorAll('.receipt-loc-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.loc === 'freezer')
  );
  document.getElementById('receipt-text').value = '';
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

// ─── Import PDF ───────────────────────────────

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
  parseBtn.textContent = 'Lecture de l\'image…';

  try {
    const base64   = await _fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';

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
              text: `Extrait les articles alimentaires de ce ticket de caisse.

Réponds UNIQUEMENT avec ce JSON valide (sans markdown):
{"items":[{"name":"Nom du produit","qty":1,"cat":"plat-prepare"}]}

Règles:
- Produits alimentaires uniquement (pas sacs, cartes, etc.)
- Ignore totaux, taxes, remises, codes articles
- qty = quantité entière ≥ 1 (défaut 1)
- Noms lisibles, sans codes internes
- cat = une de ces valeurs exactes : ${_CAT_KEYS_LIST} (ou "" si aucune)`,
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
    if (!json) throw new Error('Réponse inattendue');

    _parsedReceiptItems = (JSON.parse(json).items || [])
      .map(i => {
        const name = String(i.name || '').trim();
        return { name, qty: Math.max(1, parseInt(i.qty) || 1), cat: _resolveCategory(i.cat, name) };
      })
      .filter(i => i.name);

    document.getElementById('receipt-preview-section').style.display = '';
    renderReceiptPreview();
  } catch (err) {
    showToast('Erreur OCR : ' + err.message);
  }

  parseBtn.disabled    = false;
  parseBtn.textContent = '🔍 Analyser le texte';
}

// ─── Parsing texte via Mistral ────────────────

async function parseReceipt() {
  const text = document.getElementById('receipt-text').value.trim();
  if (!text) { showToast('Collez le texte du ticket.'); return; }
  if (!mistralKey) { showToast('Clé Mistral non configurée.'); return; }

  const btn = document.getElementById('btn-receipt-parse');
  btn.disabled    = true;
  btn.textContent = 'Analyse en cours…';

  const prompt = `Extrait les articles alimentaires d'un ticket de caisse français.

Ticket:
${text}

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans explication):
{"items":[{"name":"Nom du produit","qty":1,"cat":"plat-prepare"}]}

Règles strictes:
- Ne garde que les produits alimentaires (pas les sacs, emballages, cartes cadeaux, etc.)
- Ignore les totaux, taxes, remises, codes articles, numéros
- qty = quantité achetée (entier ≥ 1, défaut 1 si non précisé)
- Simplifie et nettoie les noms (lisibles, sans codes internes)
- Si le même produit apparaît plusieurs fois, somme les quantités
- cat = une de ces valeurs exactes : ${_CAT_KEYS_LIST} (ou "" si aucune ne correspond)`;

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

    const raw = (j.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim();
    _parsedReceiptItems = (JSON.parse(raw).items || [])
      .map(i => {
        const name = String(i.name || '').trim();
        return { name, qty: Math.max(1, parseInt(i.qty) || 1), cat: _resolveCategory(i.cat, name) };
      })
      .filter(i => i.name);
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

// ─── Prévisualisation ─────────────────────────

function _catOptions(selected) {
  const opts = ['<option value="">📦 Autre</option>'];
  for (const [, label] of Object.entries(_CAT_KEYS)) {
    opts.push(`<option value="${label}"${selected === label ? ' selected' : ''}>${esc(label)}</option>`);
  }
  return opts.join('');
}

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

  preview.innerHTML = _parsedReceiptItems.map((item, i) => `
    <div class="receipt-item-card">
      <div class="receipt-item-top">
        <input type="text" class="receipt-item-name" value="${esc(item.name)}"
          onchange="_parsedReceiptItems[${i}].name = this.value.trim()"
          placeholder="Nom du produit">
        <button class="receipt-item-del" onclick="_removeReceiptItem(${i})" title="Supprimer">✕</button>
      </div>
      <div class="receipt-item-bottom">
        <input type="number" class="receipt-item-qty" value="${item.qty}" min="1" max="99"
          onchange="_parsedReceiptItems[${i}].qty = Math.max(1, parseInt(this.value) || 1)">
        <select class="receipt-item-cat" onchange="_parsedReceiptItems[${i}].cat = this.value">
          ${_catOptions(item.cat)}
        </select>
      </div>
    </div>`).join('');

  confirmBtn.style.display = '';
}

function _removeReceiptItem(i) {
  _parsedReceiptItems.splice(i, 1);
  renderReceiptPreview();
}

// ─── Import en masse ──────────────────────────

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

// ─── Utilitaires ──────────────────────────────

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
