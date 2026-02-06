/**
 * Service API - appels relatifs pour que le proxy Vite (dev) ou Express (prod) gère l'origine
 */

export const AuthRequiredError = Symbol('AuthRequired');

function checkAuth(response) {
  if (response.status === 401) {
    const e = new Error('Session requise');
    e.code = AuthRequiredError;
    throw e;
  }
}

export async function fetchHomeData() {
  const response = await fetch('/api/home', {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchDashboardData(scope = 'all') {
  const response = await fetch(`/api/admin/dashboard?scope=${encodeURIComponent(scope)}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Commandes (liste + achats caisse) ---
/** GET /api/commandes/:id - Détail d'une commande + articles */
export async function fetchCommandeDetail(commandeId) {
  const response = await fetch(`/api/commandes/${commandeId}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(data.error || `HTTP ${response.status}`);
    if (response.status === 404) err.notFound = true;
    throw err;
  }
  return response.json();
}

/** POST /article/:id/note - Note d'un article (panier_articles.id) */
export async function saveArticleNote(panierArticleId, note, csrfToken) {
  const response = await fetch(`/article/${panierArticleId}/note`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify({ note }),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur sauvegarde note');
  }
  return response.json();
}

export async function fetchCommandes() {
  const response = await fetch('/api/commandes', {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchVentesCaisse() {
  const response = await fetch('/api/commandes/caisse', {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function saveCommandeNote(commandeId, note, csrfToken) {
  const response = await fetch(`/api/commandes/${commandeId}/note`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify({ note }),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur sauvegarde note');
  }
  return response.json();
}

export async function fetchVenteDetail(venteId) {
  const response = await fetch(`/api/caisse/ventes-historique/${venteId}`, {
    method: 'GET',
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/caisse/ventes-historique/:id/annuler - Annuler une vente (remet le stock) */
export async function annulerVente(venteId) {
  const csrfToken = typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '';
  const response = await fetch(`/api/caisse/ventes-historique/${venteId}/annuler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify({ _csrf: csrfToken }),
  });
  checkAuth(response);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

// --- Caisse Historique (liste ventes + stats) ---
/** GET /api/caisse/ventes-historique - Liste ventes avec filtres et pagination */
export async function fetchVentesHistorique(params = {}) {
  const search = new URLSearchParams();
  if (params.limit != null) search.set('limit', params.limit);
  if (params.offset != null) search.set('offset', params.offset);
  if (params.date_debut) search.set('date_debut', params.date_debut);
  if (params.date_fin) search.set('date_fin', params.date_fin);
  if (params.recherche) search.set('recherche', params.recherche);
  if (params.caissier_id != null) search.set('caissier_id', params.caissier_id);
  const response = await fetch(`/api/caisse/ventes-historique?${search}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Caisse (vente) ---
/** GET /api/caisse/produits - Produits + catégories pour la caisse */
export async function fetchCaisseProduits() {
  const response = await fetch('/api/caisse/produits', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/utilisateurs - Utilisateurs pour client caisse */
export async function fetchCaisseUtilisateurs() {
  const response = await fetch('/api/caisse/utilisateurs', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/modes-paiement - Modes de paiement */
export async function fetchCaisseModesPaiement() {
  const response = await fetch('/api/caisse/modes-paiement', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/caisse/ventes - Créer une vente */
export async function postCaisseVente(body) {
  const response = await fetch('/api/caisse/ventes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Inventaire et mouvements stock ---
/** POST /api/caisse/inventaires - Créer une session d'inventaire (draft) */
export async function createInventaire(comment) {
  const response = await fetch('/api/caisse/inventaires', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify({ comment: comment || null }),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/inventaires - Liste des sessions d'inventaire */
export async function fetchInventaires(params = {}) {
  const q = new URLSearchParams(params).toString();
  const response = await fetch(`/api/caisse/inventaires${q ? `?${q}` : ''}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/inventaires/:id - Détail inventaire + lignes */
export async function fetchInventaireDetail(id) {
  const response = await fetch(`/api/caisse/inventaires/${id}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) throw Object.assign(new Error(data.error || 'Non trouvé'), { notFound: true });
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/caisse/inventaires/:id/lignes - Ajouter ou mettre à jour une ligne (comment optionnel) */
export async function addInventaireLigne(inventaireId, productId, quantiteComptee, comment) {
  const body = { product_id: productId, quantite_comptee: quantiteComptee };
  if (comment !== undefined && comment !== null) body.comment = comment;
  const response = await fetch(`/api/caisse/inventaires/${inventaireId}/lignes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/caisse/inventaires/:id/appliquer - Appliquer l'inventaire (mise à jour stocks) */
export async function appliquerInventaire(inventaireId) {
  const response = await fetch(`/api/caisse/inventaires/${inventaireId}/appliquer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/stock-mouvements - Liste des mouvements de stock */
export async function fetchStockMouvements(params = {}) {
  const q = new URLSearchParams(params).toString();
  const response = await fetch(`/api/caisse/stock-mouvements${q ? `?${q}` : ''}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** PATCH /api/caisse/products/:id/code-ean - Mise à jour du code-barres (contexte inventaire) */
export async function updateProductCodeEan(productId, codeEan) {
  const response = await fetch(`/api/caisse/products/${productId}/code-ean`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify({ code_ean: codeEan || null }),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/caisse/paiements - Créer un paiement */
export async function postCaissePaiement(body) {
  const response = await fetch('/api/caisse/paiements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/cotisation/check?adherent_id= - Vérifier si l'adhérent doit payer la cotisation du mois (5-15 €) */
export async function fetchCaisseCotisationCheck(adherentId) {
  const q = adherentId ? `?adherent_id=${encodeURIComponent(adherentId)}` : '';
  const response = await fetch(`/api/caisse/cotisation/check${q}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/cotisation/mon-historique - Historique des cotisations de l'utilisateur connecté */
export async function fetchMonHistoriqueCotisation(params = {}) {
  const sp = new URLSearchParams();
  if (params.date_debut) sp.set('date_debut', params.date_debut);
  if (params.date_fin) sp.set('date_fin', params.date_fin);
  if (params.limit) sp.set('limit', String(params.limit));
  const q = sp.toString() ? `?${sp.toString()}` : '';
  const response = await fetch(`/api/caisse/cotisation/mon-historique${q}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/commandes-utilisateur?user_id= - Commandes catalogue d'un utilisateur (paniers soumis, non encore transformés en vente caisse) */
export async function fetchCaisseCommandesUtilisateur(userId) {
  const response = await fetch(`/api/caisse/commandes-utilisateur?user_id=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/commandes/:id/articles - Articles d'une commande avec mapping produits caisse */
export async function fetchCaisseCommandeArticles(commandeId) {
  const response = await fetch(`/api/caisse/commandes/${commandeId}/articles`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/caisse/ventes-historique/stats/resume - Stats ventes (CA, nb, ticket moyen) */
export async function fetchVentesHistoriqueStats(params = {}) {
  const search = new URLSearchParams();
  if (params.date_debut) search.set('date_debut', params.date_debut);
  if (params.date_fin) search.set('date_fin', params.date_fin);
  const response = await fetch(`/api/caisse/ventes-historique/stats/resume?${search}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/caisse/ventes-historique/:id/envoyer-facture - Envoyer la facture PDF par email (client anonyme) */
export async function postCaisseEnvoyerFacture(venteId, email) {
  const response = await fetch(`/api/caisse/ventes-historique/${venteId}/envoyer-facture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify({ email: String(email || '').trim() }),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function sendTicketPDF(venteId) {
  const response = await fetch(`/api/commandes/${venteId}/send-pdf`, {
    method: 'GET',
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur envoi email');
  }
  return response.json();
}

// --- Paniers (liste des paniers en cours) ---
export async function fetchPaniers() {
  const response = await fetch('/api/paniers', {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/panier/:id - Détail d'un panier avec articles */
export async function fetchPanierDetail(panierId) {
  const response = await fetch(`/api/panier/${panierId}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** DELETE /api/panier/:id - Supprimer un panier (vide) */
export async function deletePanierById(panierId, csrfToken) {
  const response = await fetch(`/api/panier/${panierId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur suppression');
  }
  return response.json();
}

/** GET /api/users - Liste des utilisateurs (pour changement de propriétaire, RBAC paniers.change_owner) */
export async function fetchUsersForPanier() {
  const response = await fetch('/api/users', {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/panier/:id/change-owner - Changer le propriétaire d'un panier */
export async function changePanierOwner(panierId, userId, csrfToken) {
  const response = await fetch(`/api/panier/${panierId}/change-owner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify({ user_id: userId }),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur changement propriétaire');
  }
  return response.json();
}

/** POST /panier/:id/supprimer - Supprimer un panier */
export async function deletePanier(panierId, csrfToken) {
  const response = await fetch(`/panier/${panierId}/supprimer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify({ source: '' }),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur suppression');
  }
  return response;
}

// --- Catalogues (liste des catalogues disponibles) ---
export async function fetchCatalogues() {
  const response = await fetch('/api/catalogues', {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/catalogues/:id - Détail d'un catalogue avec produits et panier */
export async function fetchCatalogueDetail(catalogueId, nouveauPanier = false) {
  const url = nouveauPanier ? `/api/catalogues/${catalogueId}?nouveau=1` : `/api/catalogues/${catalogueId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/catalogues/:id/produits-commandes-recentes - Produits commandés (60 derniers jours) pour ce catalogue */
export async function fetchCatalogueProduitsCommandesRecentes(catalogueId) {
  const response = await fetch(`/api/catalogues/${catalogueId}/produits-commandes-recentes`, {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /panier/update-quantity - Mettre à jour la quantité d'un produit */
export async function updatePanierQuantity(catalogFileId, catalogProductId, quantity, nouveauPanier, csrfToken) {
  const body = {
    catalog_file_id: catalogFileId,
    catalog_product_id: catalogProductId,
    quantity: parseInt(quantity) || 0,
    nouveau_panier: nouveauPanier === true,
  };
  const response = await fetch('/panier/update-quantity', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur mise à jour quantité');
  }
  return response.json();
}

/** POST /panier/update-note - Mettre à jour la note d'un article du panier */
export async function updatePanierArticleNote(catalogFileId, catalogProductId, note, csrfToken) {
  const body = {
    catalog_file_id: catalogFileId,
    catalog_product_id: catalogProductId,
    note: note ?? '',
  };
  const response = await fetch('/panier/update-note', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur mise à jour note');
  }
  return response.json();
}

/** POST /api/panier/:id/note - Mettre à jour la note du panier */
export async function updatePanierNote(panierId, note, csrfToken) {
  const response = await fetch(`/api/panier/${panierId}/note`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify({ note: note ?? '' }),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur mise à jour note panier');
  }
  return response.json();
}

/** POST /panier/:id/submit - Valider le panier (transformer en commande) */
export async function submitPanier(panierId, csrfToken) {
  const response = await fetch(`/panier/${panierId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur validation panier');
  }
  return response.json();
}

/** POST /commandes/:id/edit - Réouvrir une commande (redirige après succès) */
export async function reopenCommande(commandeId, csrfToken) {
  const response = await fetch(`/commandes/${commandeId}/edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'csrf-token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify({ source: '' }),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur réouverture');
  }
  return response;
}

// --- Admin Trace ---
/** GET /api/admin/trace - Liste des traces */
export async function fetchAdminTrace() {
  const response = await fetch('/api/admin/trace', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Stats ---
/** GET /api/admin/stats - Statistiques générales */
export async function fetchAdminStats() {
  const response = await fetch('/api/admin/stats', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/stats/commandes */
export async function fetchAdminStatsCommandes() {
  const response = await fetch('/api/admin/stats/commandes', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/stats/utilisateurs */
export async function fetchAdminStatsUtilisateurs() {
  const response = await fetch('/api/admin/stats/utilisateurs', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/stats/catalogues */
export async function fetchAdminStatsCatalogues() {
  const response = await fetch('/api/admin/stats/catalogues', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/stats/commandes-periode */
export async function fetchAdminStatsCommandesPeriode() {
  const response = await fetch('/api/admin/stats/commandes-periode', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Catégories ---
/** GET /api/admin/categories */
export async function fetchAdminCategories() {
  const response = await fetch('/api/admin/categories', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/admin/categories/merge */
export async function postAdminCategoriesMerge(body) {
  const response = await fetch('/api/admin/categories/merge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Fournisseurs (Suppliers) ---
/** GET /api/admin/suppliers */
export async function fetchAdminSuppliers() {
  const response = await fetch('/api/admin/suppliers', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/admin/suppliers/merge */
export async function postAdminSuppliersMerge(body) {
  const response = await fetch('/api/admin/suppliers/merge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Rôles (RBAC) ---
/** GET /api/admin/roles */
export async function fetchAdminRoles() {
  const response = await fetch('/api/admin/roles', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/roles/:id - Détail rôle + permission_ids */
export async function fetchAdminRolePermissions(roleId) {
  const response = await fetch(`/api/admin/roles/${roleId}`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/permissions - Permissions groupées par module */
export async function fetchAdminPermissions() {
  const response = await fetch('/api/admin/permissions', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** PUT /api/admin/roles/:id */
export async function putAdminRole(roleId, body) {
  const response = await fetch(`/api/admin/roles/${roleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/admin/roles */
export async function postAdminRole(body) {
  const response = await fetch('/api/admin/roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** DELETE /api/admin/roles/:id */
export async function deleteAdminRole(roleId) {
  const response = await fetch(`/api/admin/roles/${roleId}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Synthèse catalogue ---
/** GET /api/admin/catalogues/:id/synthese */
export async function fetchAdminCatalogueSynthese(catalogueId) {
  const response = await fetch(`/api/admin/catalogues/${catalogueId}/synthese`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Synthèse détaillée catalogue ---
/** GET /api/admin/catalogues/:id/synthese-detaillee */
export async function fetchAdminCatalogueSyntheseDetaillee(catalogueId) {
  const response = await fetch(`/api/admin/catalogues/${catalogueId}/synthese-detaillee`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Catalogues (liste actifs + archivés) ---
/** GET /api/admin/catalogues?scope=... */
export async function fetchAdminCatalogues(scope) {
  const url = scope ? `/api/admin/catalogues?scope=${encodeURIComponent(scope)}` : '/api/admin/catalogues';
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/catalogues/:id/alerte-recipients-count - Nombre de destinataires (personnes ayant commandé ce catalogue) */
export async function fetchAdminCataloguesAlerteRecipientsCount(catalogueId) {
  const response = await fetch(`/api/admin/catalogues/${catalogueId}/alerte-recipients-count`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Produits (liste + bulk update) ---
/** GET /api/admin/products - produits + catégories + fournisseurs */
export async function fetchAdminProducts() {
  const response = await fetch('/api/admin/products', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/admin/products/bulk-update */
export async function postAdminProductsBulkUpdate(body) {
  const response = await fetch('/api/admin/products/bulk-update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Utilisateurs (liste + rôles + bulk) ---
/** GET /api/admin/users */
export async function fetchAdminUsers() {
  const response = await fetch('/api/admin/users', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/users/:id */
export async function fetchAdminUserDetail(userId) {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/admin/users */
export async function postAdminUser(body) {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** PUT /api/admin/users/:id/roles */
export async function putAdminUserRoles(userId, body) {
  const response = await fetch(`/api/admin/users/${userId}/roles`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/admin/users/bulk-assign-roles */
export async function postAdminUsersBulkAssignRoles(body) {
  const response = await fetch('/api/admin/users/bulk-assign-roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** PUT /api/admin/users/:id/toggle-active */
export async function putAdminUserToggleActive(userId, body) {
  const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** DELETE /api/admin/users/:id */
export async function deleteAdminUser(userId) {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Bandeaux ---
/** GET /api/admin/bandeaux */
export async function fetchAdminBandeaux() {
  const response = await fetch('/api/admin/bandeaux', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/bandeaux/organizations */
export async function fetchAdminBandeauxOrganizations() {
  const response = await fetch('/api/admin/bandeaux/organizations', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/admin/bandeaux */
export async function postAdminBandeau(body) {
  const response = await fetch('/api/admin/bandeaux', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** PUT /api/admin/bandeaux/:id */
export async function putAdminBandeau(id, body) {
  const response = await fetch(`/api/admin/bandeaux/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** DELETE /api/admin/bandeaux/:id */
export async function deleteAdminBandeau(id) {
  const response = await fetch(`/api/admin/bandeaux/${id}`, {
    method: 'DELETE',
    headers: { 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Organizations ---
/** GET /api/admin/organizations */
export async function fetchAdminOrganizations() {
  const response = await fetch('/api/admin/organizations', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/organizations/:id/stats */
export async function fetchAdminOrganizationStats(id) {
  const response = await fetch(`/api/admin/organizations/${id}/stats`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/admin/organizations */
export async function postAdminOrganization(body) {
  const response = await fetch('/api/admin/organizations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** PUT /api/admin/organizations/:id */
export async function putAdminOrganization(id, body) {
  const response = await fetch(`/api/admin/organizations/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** DELETE /api/admin/organizations/:id */
export async function deleteAdminOrganization(id) {
  const response = await fetch(`/api/admin/organizations/${id}`, {
    method: 'DELETE',
    headers: { 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin Email Queue ---
/** GET /api/admin/email-queue */
export async function fetchAdminEmailQueue(limit = 500) {
  const response = await fetch(`/api/admin/email-queue?limit=${limit}`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/email-queue/settings */
export async function fetchEmailQueueSettings() {
  const response = await fetch('/api/admin/email-queue/settings', {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** PATCH /api/admin/email-queue/settings */
export async function updateEmailQueueSettings(payload) {
  const response = await fetch('/api/admin/email-queue/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// --- Admin User Roles (assignation rôles à un utilisateur) ---
// fetchAdminRoles est défini dans la section Admin Rôles (RBAC) ci-dessus

/** GET /api/admin/user-roles/:userId/roles */
export async function fetchAdminUserRoles(userId) {
  const response = await fetch(`/api/admin/user-roles/${userId}/roles`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /api/admin/user-roles/:userId/effective-permissions */
export async function fetchAdminUserEffectivePermissions(userId) {
  const response = await fetch(`/api/admin/user-roles/${userId}/effective-permissions`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** POST /api/admin/user-roles/:userId/roles */
export async function postAdminUserRole(userId, body) {
  const response = await fetch(`/api/admin/user-roles/${userId}/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/** DELETE /api/admin/user-roles/:userId/roles/:roleId */
export async function deleteAdminUserRole(userId, roleId) {
  const response = await fetch(`/api/admin/user-roles/${userId}/roles/${roleId}`, {
    method: 'DELETE',
    headers: { 'csrf-token': typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '' },
    credentials: 'include',
  });
  checkAuth(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}
