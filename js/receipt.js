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
  document.getElementById('receipt-text').value = '';
  document.getElementById('receipt-preview-section').style.display = 'none';
  const parseBtn = document.getElementById('btn-receipt-parse');
  parseBtn.disabled    = false;
  parseBtn.textContent = '🔍 Analyser le ticket';
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

// ─── Parsing via Mistral ──────────────────────

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
{"items":[{"name":"Nom du produit","qty":1}]}

Règles strictes:
- Ne garde que les produits alimentaires (pas les sacs, emballages, cartes cadeaux, etc.)
- Ignore les totaux, taxes, remises, codes articles, numéros
- qty = quantité achetée (entier ≥ 1, défaut 1 si non précisé)
- Simplifie et nettoie les noms (lisibles, sans codes internes)
- Si le même produit apparaît plusieurs fois, somme les quantités`;

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
      .map(i => ({ name: String(i.name || '').trim(), qty: Math.max(1, parseInt(i.qty) || 1) }))
      .filter(i => i.name);
    renderReceiptPreview();
  } catch (err) {
    showToast('Erreur : ' + err.message);
    btn.disabled    = false;
    btn.textContent = '🔍 Analyser le ticket';
    return;
  }

  btn.disabled    = false;
  btn.textContent = '🔍 Analyser à nouveau';
}

// ─── Prévisualisation ─────────────────────────

function renderReceiptPreview() {
  const section    = document.getElementById('receipt-preview-section');
  const preview    = document.getElementById('receipt-preview');
  const confirmBtn = document.getElementById('btn-receipt-confirm');
  section.style.display = '';

  if (!_parsedReceiptItems.length) {
    preview.innerHTML     = '<div style="color:var(--text-faint);font-size:0.83rem;padding:8px 0;">Aucun produit trouvé.</div>';
    confirmBtn.style.display = 'none';
    return;
  }

  preview.innerHTML = _parsedReceiptItems.map((item, i) => `
    <div class="receipt-item-row">
      <input type="text" class="receipt-item-name" value="${esc(item.name)}"
        onchange="_parsedReceiptItems[${i}].name = this.value.trim()"
        placeholder="Nom du produit">
      <input type="number" class="receipt-item-qty" value="${item.qty}" min="1" max="99"
        onchange="_parsedReceiptItems[${i}].qty = Math.max(1, parseInt(this.value) || 1)">
      <button class="receipt-item-del" onclick="_removeReceiptItem(${i})" title="Supprimer">✕</button>
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
    const err = await _upsertItem({ name: item.name, qty: item.qty, cat: '', exp: null, location: receiptLocation });
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
