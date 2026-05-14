// ─────────────────────────────────────────────
// SCANNER CODE-BARRES
// ─────────────────────────────────────────────

// Mapping Open Food Facts categories_tags → catégories app
// Priorité : tags structurés d'abord, puis mots-clés texte libre
const CATEGORY_MAP = [
  {
    tags:     ['en:meats', 'en:meat', 'en:poultry', 'en:beef', 'en:pork', 'en:chicken',
               'en:turkey', 'en:lamb', 'en:veal', 'en:charcuteries', 'en:deli-meats', 'en:sausages'],
    keywords: ['viande', 'meat', 'poulet', 'bœuf', 'boeuf', 'porc', 'veau', 'agneau',
               'charcuterie', 'jambon', 'saucisse', 'lardon', 'steak', 'rôti', 'escalope', 'dinde'],
    cat: '🥩 Viande',
  },
  {
    tags:     ['en:fish', 'en:fishes', 'en:seafood', 'en:crustaceans', 'en:shellfish', 'en:mollusks'],
    keywords: ['poisson', 'fish', 'saumon', 'thon', 'cabillaud', 'crevette', 'sardine',
               'maquereau', 'dorade', 'sole', 'seafood', 'fruits de mer', 'moule', 'coquille'],
    cat: '🐟 Poisson',
  },
  {
    tags:     ['en:cheeses', 'en:cheese'],
    keywords: ['fromage', 'cheese', 'camembert', 'brie', 'gruyère', 'emmental',
               'parmesan', 'mozzarella', 'gouda', 'comté', 'roquefort', 'chèvre'],
    cat: '🧀 Fromage',
  },
  {
    tags:     ['en:dairies', 'en:dairy', 'en:milks', 'en:yogurts', 'en:creams',
               'en:butters', 'en:fermented-milks', 'en:fresh-cheeses'],
    keywords: ['lait', 'dairy', 'yaourt', 'yogurt', 'crème', 'beurre', 'cream', 'milk', 'kéfir'],
    cat: '🥛 Laitier',
  },
  {
    tags:     ['en:eggs', 'en:egg-based-products'],
    keywords: ['oeuf', 'egg', 'œuf'],
    cat: '🍳 Œufs',
  },
  {
    tags:     ['en:vegetables', 'en:fresh-vegetables', 'en:frozen-vegetables',
               'en:canned-vegetables', 'en:root-vegetables', 'en:leafy-vegetables'],
    keywords: ['légume', 'vegetable', 'carotte', 'tomate', 'épinard', 'courgette',
               'salade', 'haricot', 'brocoli', 'poireau', 'champignon', 'oignon', 'ail',
               'concombre', 'poivron', 'lentille', 'pois chiche'],
    cat: '🥦 Légumes',
  },
  {
    tags:     ['en:fruits', 'en:fresh-fruits', 'en:frozen-fruits', 'en:dried-fruits'],
    keywords: ['fruit', 'pomme', 'poire', 'banane', 'orange', 'fraise', 'cerise',
               'raisin', 'mangue', 'ananas', 'pêche', 'abricot', 'kiwi', 'citron'],
    cat: '🍎 Fruits',
  },
  {
    tags:     ['en:pasta', 'en:rice', 'en:cereals-and-their-products', 'en:grains',
               'en:semolina', 'en:flours', 'en:corn', 'en:quinoa'],
    keywords: ['féculent', 'pâtes', 'riz', 'semoule', 'céréale', 'pasta', 'rice',
               'quinoa', 'boulgour', 'blé', 'farine', 'maïs', 'polenta'],
    cat: '🍚 Féculents',
  },
  {
    tags:     ['en:breads', 'en:bread', 'en:viennoiseries', 'en:rolls'],
    keywords: ['pain', 'bread', 'baguette', 'brioche', 'croissant', 'viennoiserie'],
    cat: '🍞 Boulangerie',
  },
  {
    tags:     ['en:prepared-meals', 'en:ready-meals', 'en:frozen-meals',
               'en:convenience-foods', 'en:meals', 'en:soups', 'en:pizzas',
               'en:quiches', 'en:lasagnas', 'en:gratins', 'en:sandwiches'],
    keywords: ['plat prépar', 'plat cuisiné', 'surgelé', 'lasagne', 'pizza', 'quiche',
               'gratin', 'soupe', 'potage', 'hachis', 'parmentier', 'wok', 'paëlla', 'risotto'],
    cat: '🍱 Plat préparé',
  },
  {
    tags:     ['en:beverages', 'en:drinks', 'en:fruit-juices-and-nectars', 'en:sodas',
               'en:waters', 'en:wines', 'en:beers', 'en:coffees', 'en:teas',
               'en:plant-based-milks', 'en:energy-drinks', 'en:syrups'],
    keywords: ['boisson', 'beverage', 'jus', 'soda', 'eau', 'thé', 'café', 'sirop', 'nectar'],
    cat: '🧃 Boissons',
  },
  {
    tags:     ['en:condiments', 'en:sauces', 'en:spreads', 'en:dressings', 'en:oils',
               'en:vinegars', 'en:mustards', 'en:jams', 'en:honeys', 'en:pickles',
               'en:canned-goods', 'en:preserved-foods'],
    keywords: ['condiment', 'sauce', 'huile', 'vinaigre', 'moutarde', 'ketchup',
               'mayonnaise', 'confiture', 'miel', 'cornichon', 'pesto', 'tapenade'],
    cat: '🫙 Condiments',
  },
  {
    tags:     ['en:snacks', 'en:sweet-snacks', 'en:salty-snacks', 'en:cookies',
               'en:biscuits', 'en:crackers', 'en:chips', 'en:chocolates',
               'en:candies', 'en:confectioneries', 'en:pastries', 'en:cakes'],
    keywords: ['biscuit', 'cookie', 'chips', 'snack', 'chocolat', 'bonbon',
               'cracker', 'gâteau', 'friandise', 'candy', 'cake'],
    cat: '🍪 Biscuits & snacks',
  },
];

function guessCategoryFromTags(p) {
  const tags = (p.categories_tags || []).map(t => t.toLowerCase());
  const text = ((p.categories || '') + ' ' + (p.food_groups || '')).toLowerCase();

  for (const { tags: entryTags = [], keywords = [], cat } of CATEGORY_MAP) {
    if (entryTags.some(t => tags.includes(t))) return cat;
    if (keywords.some(k => text.includes(k)))  return cat;
  }
  return '';
}

function guessCategoryFromName(name) {
  const text = name.toLowerCase();
  for (const { keywords = [], cat } of CATEGORY_MAP) {
    if (keywords.some(k => text.includes(k))) return cat;
  }
  return '';
}

// ─── Ouverture / fermeture ────────────────────

async function openBarcode() {
  scanMode = 'add';
  document.getElementById('scan-mode-add').classList.add('active');
  document.getElementById('scan-mode-delete').classList.remove('active');
  setScanLocation('freezer');
  document.getElementById('modal-barcode').classList.add('open');
  document.getElementById('scan-result-form').style.display = 'none';
  document.getElementById('scan-delete-result').style.display = 'none';

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

// ─── Mode ajouter / supprimer ─────────────────

function setScanMode(mode) {
  scanMode = mode;
  document.getElementById('scan-mode-add').classList.toggle('active', mode === 'add');
  document.getElementById('scan-mode-delete').classList.toggle('active', mode === 'delete');
  document.getElementById('scan-result-form').style.display = 'none';
  document.getElementById('scan-delete-result').style.display = 'none';
  const ind = document.getElementById('scan-indicator');
  ind.className = 'scan-indicator loading';
  ind.innerHTML = '<span class="pulse">●</span>&nbsp;Cherche un code-barres…';
  lastScannedCode = null;
  if (!scannerRunning) startDecoding(document.getElementById('camera-view'));
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
      const cat  = guessCategoryFromTags(p);

      if (name) {
        ind.className = 'scan-indicator found';
        ind.innerHTML = '✓ &nbsp;' + esc(name);
        stopScanner();
        if (scanMode === 'delete') {
          _showDeleteResult(name);
        } else {
          document.getElementById('scan-name').value = name;
          document.getElementById('scan-cat').value  = cat;
          document.getElementById('scan-qty').value  = 1;
          document.getElementById('scan-exp').value  = '';
          document.getElementById('scan-result-form').style.display = 'flex';
          document.getElementById('scan-exp').focus();
        }
        return;
      }
    }

    // Produit non trouvé dans OPF
    ind.className = 'scan-indicator';
    ind.innerHTML = `Code <strong>${code}</strong> introuvable — saisissez le nom :`;
    stopScanner();
    if (scanMode === 'delete') {
      _showDeleteResult(null);
    } else {
      document.getElementById('scan-name').value = '';
      document.getElementById('scan-cat').value  = '';
      document.getElementById('scan-result-form').style.display = 'flex';
      document.getElementById('scan-name').focus();
    }
  } catch (e) {
    ind.className = 'scan-indicator';
    ind.textContent = 'Erreur réseau.';
    stopScanner();
    if (scanMode === 'add') {
      document.getElementById('scan-result-form').style.display = 'flex';
      document.getElementById('scan-name').focus();
    }
  }
}

// ─── Suppression par scan ──────────────────────

function _showDeleteResult(name) {
  const container = document.getElementById('scan-delete-result');
  const locLabel  = { fridge: '🧊 Frigo', freezer: '❄️ Congélateur', pantry: '🫙 Placard' };

  if (!name) {
    container.innerHTML = '<div style="color:var(--text-faint);font-size:0.85rem;text-align:center;padding:8px 0;">Produit non reconnu — impossible de rechercher dans le stock.</div>';
    container.style.display = 'flex';
    return;
  }

  const matches = [];
  for (const loc of ['fridge', 'freezer', 'pantry']) {
    const item = appData[loc].find(i => i.name.toLowerCase() === name.toLowerCase());
    if (item) matches.push({ ...item, location: loc });
  }

  if (!matches.length) {
    container.innerHTML = `<div style="color:var(--text-faint);font-size:0.85rem;text-align:center;padding:8px 0;">« ${esc(name)} » n'est pas dans votre stock.</div>`;
  } else {
    container.innerHTML = matches.map(item => `
      <div class="scan-delete-row">
        <div class="scan-delete-info">
          <span class="scan-delete-name">${esc(item.name)}</span>
          <span class="scan-delete-meta">${locLabel[item.location]} &nbsp;·&nbsp; Qté : ${item.qty}</span>
        </div>
        <div class="scan-delete-btns">
          <button class="btn-scan-minus" onclick="removeOneFromScan('${item.id}','${item.location}',${item.qty})">−1</button>
          <button class="btn-scan-del"   onclick="deleteFromScan('${item.id}')">Supprimer</button>
        </div>
      </div>`).join('');
  }
  container.style.display = 'flex';
}

async function removeOneFromScan(id, location, currentQty) {
  if (currentQty <= 1) { await deleteFromScan(id); return; }
  await changeQty(id, -1);
  showToast('Quantité mise à jour ✓');
  closeBarcode();
}

async function deleteFromScan(id) {
  await deleteItem(id);
  showToast('Produit supprimé ✓');
  closeBarcode();
}
