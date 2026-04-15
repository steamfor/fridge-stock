// ─────────────────────────────────────────────
// ÉTAT GLOBAL DE L'APPLICATION
// ─────────────────────────────────────────────

// Supabase
let sbClient    = null;
let realtimeSub = null;
let mistralKey  = '';

// Navigation
let currentTab  = 'fridge';
let currentSort = 'name';

// Données stock (chargées depuis Supabase)
let appData = { fridge: [], freezer: [] };

// Scanner
let barcodeStream   = null;
let barcodeReader   = null;
let scannerRunning  = false;
let lastScannedCode = null;
let scanLocation    = 'freezer'; // Congélateur par défaut

// Menu IA — options sélectionnées
let menuDays  = '1';
let menuDiet  = 'aucune contrainte';
let menuPrio  = 'utiliser en priorité les produits qui expirent bientôt';
let menuTime  = 'rapide';
let menuMeals = new Set(['déjeuner', 'dîner']);
