/**
 * Cache IndexedDB pour la page inventaire (produits + catégories + draft + sync)
 * Phase 2 + 3 + 4 + 5 offline
 */
const DB_NAME = 'coopaz-inventaire-offline';
const DB_VERSION = 3;
const STORE_PRODUITS = 'produits';
const STORE_CATEGORIES = 'categories';
const STORE_META = 'meta';
const STORE_DRAFT = 'inventaire_draft';
const STORE_SYNC_QUEUE = 'sync_queue';
const META_KEY = 'cache';
const DRAFT_KEY = 'current';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non disponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PRODUITS)) {
        db.createObjectStore(STORE_PRODUITS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
      if (!db.objectStoreNames.contains(STORE_DRAFT)) {
        db.createObjectStore(STORE_DRAFT);
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

/** Convertir en objets bruts (IndexedDB ne peut pas cloner les Proxies Vue) */
function toPlainObjects(arr) {
  return (arr || []).map((item) => JSON.parse(JSON.stringify(item)));
}

/**
 * Sauvegarder produits et catégories dans le cache
 * @param {Array} produits
 * @param {Array} categories
 */
export async function saveProduitsCache(produits, categories) {
  const db = await openDB();
  const plainProduits = toPlainObjects(produits);
  const plainCategories = toPlainObjects(categories);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PRODUITS, STORE_CATEGORIES, STORE_META], 'readwrite');
    const storeP = tx.objectStore(STORE_PRODUITS);
    const storeC = tx.objectStore(STORE_CATEGORIES);
    const storeM = tx.objectStore(STORE_META);

    storeP.clear();
    storeC.clear();
    plainProduits.forEach((p) => storeP.put(p));
    plainCategories.forEach((c) => storeC.put(c));
    storeM.put({ lastSync: Date.now() }, META_KEY);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Charger produits et catégories depuis le cache
 * @returns {{ produits: Array, categories: Array } | null}
 */
export async function getProduitsCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PRODUITS, STORE_CATEGORIES], 'readonly');
    const reqP = tx.objectStore(STORE_PRODUITS).getAll();
    const reqC = tx.objectStore(STORE_CATEGORIES).getAll();

    let produits = [];
    let categories = [];

    reqP.onsuccess = () => { produits = reqP.result || []; };
    reqC.onsuccess = () => { categories = reqC.result || []; };

    tx.oncomplete = () => {
      db.close();
      if (produits.length === 0 && categories.length === 0) {
        resolve(null);
      } else {
        resolve({ produits, categories });
      }
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Vérifier si le cache contient des données
 * @returns {boolean}
 */
export async function hasProduitsCache() {
  try {
    const data = await getProduitsCache();
    return data !== null && (data.produits?.length > 0 || data.categories?.length > 0);
  } catch {
    return false;
  }
}

// --- Phase 3 : draft inventaire local ---

export function isLocalInventaireId(id) {
  return id != null && String(id).startsWith('local-');
}

/**
 * Créer une session d'inventaire locale (hors ligne)
 * @returns {Promise<string>} id local (ex: local-1234567890)
 */
export async function createLocalDraft() {
  const id = 'local-' + Date.now();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_DRAFT], 'readwrite');
    tx.objectStore(STORE_DRAFT).put({ id, lignes: [] }, DRAFT_KEY);
    tx.oncomplete = () => { db.close(); resolve(id); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Récupérer le brouillon d'inventaire local
 * @returns {Promise<{ id: string, lignes: Array } | null>}
 */
export async function getInventaireDraft() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_DRAFT], 'readonly');
    const req = tx.objectStore(STORE_DRAFT).get(DRAFT_KEY);
    req.onsuccess = () => {
      db.close();
      const d = req.result;
      resolve(d && d.id ? d : null);
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Sauvegarder les lignes du brouillon local
 * @param {Array} lignes
 */
export async function saveInventaireDraftLignes(lignes) {
  const draft = await getInventaireDraft();
  if (!draft) return;
  const plain = toPlainObjects(lignes);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_DRAFT], 'readwrite');
    tx.objectStore(STORE_DRAFT).put({ id: draft.id, lignes: plain }, DRAFT_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Supprimer le brouillon local
 */
export async function clearInventaireDraft() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_DRAFT], 'readwrite');
    tx.objectStore(STORE_DRAFT).delete(DRAFT_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// --- Phase 4 + 5 : sync queue ---

/**
 * Mettre à jour le code_ean d'un produit dans le cache
 */
export async function updateProductCodeEanInCache(productId, codeEan) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PRODUITS], 'readwrite');
    const store = tx.objectStore(STORE_PRODUITS);
    const req = store.get(productId);
    req.onsuccess = () => {
      const p = req.result;
      if (p) {
        p.code_ean = codeEan;
        store.put(p);
      }
      tx.oncomplete = () => { db.close(); resolve(); };
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Enfiler une mise à jour code EAN (Phase 5)
 */
export async function queueCodeEanUpdate(productId, codeEan) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SYNC_QUEUE], 'readwrite');
    tx.objectStore(STORE_SYNC_QUEUE).add({
      action: 'update_code_ean',
      productId,
      codeEan: codeEan || null,
      createdAt: Date.now(),
    });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Récupérer les mises à jour code EAN en attente
 */
export async function getSyncQueueCodeEan() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SYNC_QUEUE], 'readonly');
    const req = tx.objectStore(STORE_SYNC_QUEUE).getAll();
    req.onsuccess = () => {
      db.close();
      const all = req.result || [];
      resolve(all.filter((e) => e.action === 'update_code_ean'));
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Supprimer une entrée de la file de sync
 */
export async function removeSyncQueueEntry(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SYNC_QUEUE], 'readwrite');
    tx.objectStore(STORE_SYNC_QUEUE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Vider toutes les entrées update_code_ean après traitement
 */
export async function clearSyncQueueCodeEan() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SYNC_QUEUE], 'readwrite');
    const store = tx.objectStore(STORE_SYNC_QUEUE);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      all.filter((e) => e.action === 'update_code_ean').forEach((e) => store.delete(e.id));
      tx.oncomplete = () => { db.close(); resolve(); };
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
