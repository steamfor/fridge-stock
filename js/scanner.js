// ─────────────────────────────────────────────
// SCANNER CODE-BARRES
// ─────────────────────────────────────────────

const CATEGORY_MAP = [
  { keywords: ['viande', 'meat'],               cat: '🥩 Viande'        },
  { keywords: ['poisson', 'fish'],               cat: '🐟 Poisson'       },
  { keywords: ['lait', 'dairy', 'yaourt'],       cat: '🥛 Laitier'       },
  { keywords: ['fromage', 'cheese'],             cat: '🧀 Fromage'       },
  { keywords: ['légume', 'vegetable'],           cat: '🥦 Légumes'       },
  { keywords: ['fruit'],                         cat: '🍎 Fruits'        },
  { keywords: ['boisson', 'beverage'],           cat: '🧃 Boissons'      },
  { keywords: ['pain', 'bread'],                 cat: '🍞 Boulangerie'   },
  { keywords: ['oeuf', 'egg'],                   cat: '🍳 Œufs'         },
];

function guessCategoryFromTags(categoriesStr) {
  const lower = (categoriesStr || '').toLowerCase();
  const match = CATEGORY_MAP.find(({ keywords }) => keywords.some(k => lower.includes(k)));
  return match ? match.cat : '';
}

// ─── Ouverture / fermeture ────────────────────

async function openBarcode() {
  // Réinitialiser la destination au congélateur par défaut
  setScanLocation('freezer');

  document.getElementById('modal-barcode').classList.add('open');
  document.getElementById('scan-result-form').style.display = 'none';

  const ind = document.getElementById('scan-indicator');
  ind.className = 'scan-indicator';
  ind.textContent = 'Démarrage de la caméra…';
  lastScannedCode = null;

  try {
    barcodeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 } }
    });
    const video = document.getElementById('camera-view');
    video.srcObject = barcodeStream;
    await video.play();
    startDecoding(video);
  } catch (e) {
    document.getElementById('scan-indicator').textContent = '❌ Accès caméra refusé.';
  }
}

function closeBarcode() {
  stopScanner();
  if (barcodeStream) {
    barcodeStream.getTracks().forEach(t => t.stop());
    barcodeStream = null;
  }
  document.getElementById('camera-view').srcObject = null;
  document.getElementById('modal-barcode').classList.remove('open');
  lastScannedCode = null;
}

function closeBarcodeOnBg(e) {
  if (e.target === document.getElementById('modal-barcode')) closeBarcode();
}

// ─── Décodage ─────────────────────────────────

function startDecoding(video) {
  if ('BarcodeDetector' in window) { useNativeDetector(video); return; }
  if (window.ZXing)                { useZXing(video);          return; }
  document.getElementById('scan-indicator').textContent = 'Scanner non supporté sur ce navigateur.';
}

function useNativeDetector(video) {
  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
  const ind = document.getElementById('scan-indicator');
  ind.className = 'scan-indicator loading';
  ind.innerHTML = '<span class="pulse">●</span>&nbsp;Cherche un code-barres…';
  scannerRunning = true;

  function loop() {
    if (!scannerRunning) return;
    detector.detect(video)
      .then(codes => {
        if (codes.length > 0) {
          const code = codes[0].rawValue;
          if (code !== lastScannedCode) { lastScannedCode = code; onBarcodeFound(code); return; }
        }
        requestAnimationFrame(loop);
      })
      .catch(() => requestAnimationFrame(loop));
  }
  loop();
}

function useZXing(video) {
  const hints = new Map([
    [ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.CODE_128]],
    [ZXing.DecodeHintType.TRY_HARDER, true],
  ]);
  barcodeReader = new ZXing.BrowserMultiFormatReader(hints);
  const ind = document.getElementById('scan-indicator');
  ind.className = 'scan-indicator loading';
  ind.innerHTML = '<span class="pulse">●</span>&nbsp;Cherche un code-barres…';
  scannerRunning = true;

  barcodeReader.decodeFromVideoElement(video, result => {
    if (!scannerRunning) return;
    if (result) {
      const code = result.getText();
      if (code !== lastScannedCode) { lastScannedCode = code; onBarcodeFound(code); }
    }
  });
}

function stopScanner() {
  scannerRunning = false;
  if (barcodeReader) {
    try { barcodeReader.reset(); } catch (e) {}
    barcodeReader = null;
  }
}

// ─── Recherche produit (Open Food Facts) ──────

async function onBarcodeFound(code) {
  const ind = document.getElementById('scan-indicator');
  ind.className = 'scan-indicator loading';
  ind.innerHTML = `<span class="pulse">●</span>&nbsp;Code <strong>${code}</strong> — Recherche…`;

  try {
    const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const json = await res.json();

    if (json.status === 1 && json.product) {
      const p    = json.product;
      const name = p.product_name_fr || p.product_name || p.generic_name_fr || '';
      const cat  = guessCategoryFromTags(p.categories);

      if (name) {
        ind.className = 'scan-indicator found';
        ind.innerHTML = '✓ &nbsp;' + esc(name);
        document.getElementById('scan-name').value = name;
        document.getElementById('scan-cat').value  = cat;
        document.getElementById('scan-qty').value  = 1;
        document.getElementById('scan-exp').value  = '';
        document.getElementById('scan-result-form').style.display = 'flex';
        document.getElementById('scan-exp').focus();
        stopScanner();
        return;
      }
    }

    // Produit non trouvé — saisie manuelle
    ind.className = 'scan-indicator';
    ind.innerHTML = `Code <strong>${code}</strong> introuvable — saisissez le nom :`;
    document.getElementById('scan-name').value = '';
    document.getElementById('scan-cat').value  = '';
    document.getElementById('scan-result-form').style.display = 'flex';
    document.getElementById('scan-name').focus();
    stopScanner();
  } catch (e) {
    ind.className = 'scan-indicator';
    ind.textContent = 'Erreur réseau.';
    document.getElementById('scan-result-form').style.display = 'flex';
    document.getElementById('scan-name').focus();
    stopScanner();
  }
}
