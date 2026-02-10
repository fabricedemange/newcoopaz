import { defineStore } from 'pinia';
import {
  fetchCaisseProduits,
  fetchCaisseUtilisateurs,
  fetchCaisseModesPaiement,
  postCaisseVente,
  postCaissePaiement,
  postCaisseEnvoyerFacture,
  fetchCaisseCotisationCheck,
  fetchCaisseCommandesUtilisateur,
  fetchCaisseCommandeArticles,
} from '@/api';

const STORAGE_KEY = 'caisse_paniers_sauvegardes';

function getPaniersSauvegardes() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function savePaniersSauvegardes(paniers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paniers));
  } catch (e) {
    console.error('Erreur écriture localStorage:', e);
  }
}

function roundToCent(amount) {
  return Math.round(amount * 100) / 100;
}

/** Ajuste les lignes avoir pour que le total panier ne soit jamais négatif (total produits >= total avoirs). */
function ajusterAvoirsPourTotalPositif(lignes) {
  const totalProduits = lignes
    .filter((l) => !l.is_avoir)
    .reduce((sum, l) => sum + roundToCent(l.quantite * l.prix_unitaire), 0);
  const avoirLines = lignes.filter((l) => l.is_avoir);
  const totalAvoirs = avoirLines.reduce((sum, l) => sum + Math.abs(roundToCent(l.prix_unitaire)), 0);
  if (totalAvoirs <= totalProduits) return;
  let restant = totalProduits;
  for (const ligne of avoirLines) {
    const montantActuel = Math.abs(roundToCent(ligne.prix_unitaire));
    const nouveauMontant = roundToCent(Math.min(montantActuel, restant));
    ligne.prix_unitaire = -nouveauMontant;
    restant -= nouveauMontant;
  }
}

export const useCaisseStore = defineStore('caisse', {
  state: () => ({
    produits: [],
    categories: [],
    searchQuery: '',
    selectedCategorie: null,
    produitsLoading: false,
    utilisateurs: [],
    selectedUtilisateur: null,
    lignes: [],
    currentPanierId: null,
    savedPaniers: getPaniersSauvegardes(),
    showPaniersModal: false,
    showAvoirModal: false,
    avoirMontant: 0,
    avoirCommentaire: '',
    showPaiementModal: false,
    /** Lignes de paiement multi-modes : [{ mode_paiement_id, montant }, ...] */
    lignesPaiement: [],
    modesPaiement: [],
    error: null,
    // Charger une commande catalogue
    commandesUtilisateur: [],
    loadingCommandes: false,
    commandeSelectionnee: null,
    showModalChargerCommande: false,
    commandeACharger: null,
    selectedCommandeId: null,
    cotisationCheck: null,
    /** Email pour envoyer la facture PDF (client anonyme) */
    emailFactureAnonyme: '',
  }),

  getters: {
    /** Produits filtrés par la recherche uniquement (pour badges catégories). */
    produitsFiltresParRecherche(state) {
      let filtered = [...state.produits];
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter((p) => p.nom.toLowerCase().includes(q));
      }
      return filtered;
    },
    /** Produits affichés : recherche + catégorie sélectionnée éventuelle. */
    produitsFiltrés(state, getters) {
      const parRecherche = getters?.produitsFiltresParRecherche ?? (() => {
        let f = [...state.produits];
        if (state.searchQuery) {
          const q = state.searchQuery.toLowerCase();
          f = f.filter((p) => p.nom.toLowerCase().includes(q));
        }
        return f;
      })();
      let filtered = [...parRecherche];
      if (state.selectedCategorie) {
        filtered = filtered.filter((p) => p.category_id === state.selectedCategorie);
      }
      return filtered.sort((a, b) => {
        const sa = Number(a.stock) ?? 0;
        const sb = Number(b.stock) ?? 0;
        return sb - sa;
      });
    },
    total(state) {
      const sum = state.lignes.reduce((acc, l) => {
        return acc + roundToCent(l.quantite * l.prix_unitaire);
      }, 0);
      return roundToCent(sum);
    },
    nombreArticles(state) {
      return state.lignes.length;
    },
    categoriesFiltrées(state, getters) {
      const parRecherche = getters?.produitsFiltresParRecherche ?? (() => {
        let f = [...state.produits];
        if (state.searchQuery) {
          const q = state.searchQuery.toLowerCase();
          f = f.filter((p) => p.nom.toLowerCase().includes(q));
        }
        return f;
      })();
      const categoryIds = new Set(
        parRecherche.filter((p) => p.category_id).map((p) => p.category_id)
      );
      return state.categories.filter((c) => categoryIds.has(c.id));
    },
    /** true si le panier contient déjà une ligne cotisation mensuelle */
    aPanierCotisation(state) {
      return state.lignes.some((l) => l.is_cotisation === true);
    },
    /** Total des montants saisis dans les lignes de paiement */
    totalPaye(state) {
      return roundToCent(
        (state.lignesPaiement || []).reduce((s, l) => s + (parseFloat(l.montant) || 0), 0)
      );
    },
    /** Reste à payer (négatif = trop perçu, rendu monnaie) */
    resteAPayer(state, getters) {
      const total = getters?.total ?? roundToCent(state.lignes.reduce((acc, l) => acc + roundToCent(l.quantite * l.prix_unitaire), 0));
      const totalPaye = getters?.totalPaye ?? roundToCent((state.lignesPaiement || []).reduce((s, l) => s + (parseFloat(l.montant) || 0), 0));
      return roundToCent(total - totalPaye);
    },
    /** true si on peut valider (total payé >= total et chaque ligne avec montant > 0 a un mode) */
    peutValiderPaiement(state, getters) {
      const total = getters?.total ?? roundToCent(state.lignes.reduce((acc, l) => acc + roundToCent(l.quantite * l.prix_unitaire), 0));
      const totalPaye = getters?.totalPaye ?? roundToCent((state.lignesPaiement || []).reduce((s, l) => s + (parseFloat(l.montant) || 0), 0));
      if (totalPaye <= 0) return false;
      if (totalPaye < total) return false;
      const lignes = state.lignesPaiement || [];
      const hasInvalid = lignes.some(
        (l) => (parseFloat(l.montant) || 0) > 0 && !l.mode_paiement_id
      );
      return !hasInvalid;
    },
  },

  actions: {
    async chargerProduits() {
      this.produitsLoading = true;
      this.error = null;
      try {
        const data = await fetchCaisseProduits();
        if (data.success) {
          this.produits = data.produits || [];
          this.categories = data.categories || [];
        }
      } catch (e) {
        this.error = e.message;
      } finally {
        this.produitsLoading = false;
      }
    },

    async chargerUtilisateurs() {
      try {
        const data = await fetchCaisseUtilisateurs();
        if (data.success && data.utilisateurs?.length) {
          this.utilisateurs = data.utilisateurs;
          const anonyme = data.utilisateurs.find((u) => (u.username || '').toLowerCase() === 'anonyme');
          this.selectedUtilisateur = anonyme ? anonyme.id : data.utilisateurs[0]?.id ?? null;
        }
      } catch (e) {
        console.error('Erreur chargement utilisateurs:', e);
      }
    },

    async chargerModesPaiement() {
      try {
        const data = await fetchCaisseModesPaiement();
        if (data.success) {
          this.modesPaiement = data.modes || [];
        }
      } catch (e) {
        console.error('Erreur chargement modes paiement:', e);
      }
    },

    /** Ajoute un produit au panier (ou incrémente la quantité). Retourne l'index de la ligne concernée pour le focus. */
    ajouterProduit(produit) {
      const existingIndex = this.lignes.findIndex((l) => l.produit_id === produit.id);
      if (existingIndex >= 0) {
        const existing = this.lignes[existingIndex];
        existing.quantite += parseFloat(produit.quantite_min) || 1;
        return existingIndex;
      }
      this.lignes.push({
        produit_id: produit.id,
        nom_produit: produit.nom,
        quantite: parseFloat(produit.quantite_min) || 1,
        prix_unitaire: parseFloat(produit.prix) || 0,
        unite: produit.unite || 'Pièce',
        quantite_min: parseFloat(produit.quantite_min) || 1,
        is_avoir: false,
      });
      return this.lignes.length - 1;
    },

    /** Trouve un produit par code EAN et l’ajoute au panier. Retourne { found: true, produit } ou { found: false }. */
    ajouterProduitParEan(ean) {
      const code = String(ean || '').trim().replace(/\s/g, '');
      if (!code) return { found: false };
      const produit = this.produits.find(
        (p) => p.code_ean && String(p.code_ean).trim().replace(/\s/g, '') === code
      );
      if (produit) {
        const lineIndex = this.ajouterProduit(produit);
        return { found: true, produit, lineIndex };
      }
      return { found: false };
    },

    modifierQuantite(index, nouvelleQuantite) {
      const ligne = this.lignes[index];
      if (ligne && nouvelleQuantite > 0) {
        ligne.quantite = parseFloat(nouvelleQuantite);
        if (!ligne.is_avoir) ajusterAvoirsPourTotalPositif(this.lignes);
      }
    },

    supprimerLigne(index) {
      const ligne = this.lignes[index];
      const etaitAvoir = ligne?.is_avoir === true;
      this.lignes.splice(index, 1);
      if (!etaitAvoir) ajusterAvoirsPourTotalPositif(this.lignes);
    },

    viderPanier() {
      this.lignes = [];
      this.currentPanierId = null;
      this.commandeSelectionnee = null;
    },

    sauvegarderPanier() {
      if (this.lignes.length === 0) return;
      const panier = {
        id: this.currentPanierId || Date.now(),
        lignes: JSON.parse(JSON.stringify(this.lignes)),
        selectedUtilisateur: this.selectedUtilisateur,
        saved_at: new Date().toISOString(),
        total: this.total,
      };
      let paniers = getPaniersSauvegardes();
      const idx = paniers.findIndex((p) => p.id === panier.id);
      if (idx >= 0) paniers[idx] = panier;
      else paniers.push(panier);
      savePaniersSauvegardes(paniers);
      this.savedPaniers = getPaniersSauvegardes();
      this.currentPanierId = panier.id;
    },

    chargerPanier(panierId) {
      const paniers = getPaniersSauvegardes();
      const panier = paniers.find((p) => p.id === panierId);
      if (panier) {
        this.lignes = JSON.parse(JSON.stringify(panier.lignes));
        this.selectedUtilisateur = panier.selectedUtilisateur;
        this.currentPanierId = panier.id;
        this.showPaniersModal = false;
      }
    },

    supprimerPanier(panierId) {
      let paniers = getPaniersSauvegardes().filter((p) => p.id !== panierId);
      savePaniersSauvegardes(paniers);
      this.savedPaniers = paniers;
      if (this.currentPanierId === panierId) this.viderPanier();
    },

    nouveauPanier() {
      if (this.lignes.length > 0 && !confirm('Effacer le panier actuel ?')) return;
      this.viderPanier();
    },

    ajouterAvoir() {
      const montant = parseFloat(this.avoirMontant);
      if (!montant || montant <= 0) return;
      const totalProduits = this.lignes
        .filter((l) => !l.is_avoir)
        .reduce((sum, l) => sum + roundToCent(l.quantite * l.prix_unitaire), 0);
      const totalAvoirs = this.lignes
        .filter((l) => l.is_avoir)
        .reduce((sum, l) => sum + Math.abs(roundToCent(l.prix_unitaire)), 0);
      const maxAvoir = roundToCent(totalProduits - totalAvoirs);
      if (maxAvoir <= 0) return;
      const montantArrondi = roundToCent(montant);
      const montantEffectif = roundToCent(Math.min(montantArrondi, maxAvoir));
      const commentaire = this.avoirCommentaire || 'Remboursement';
      const libelle =
        montantEffectif < montantArrondi
          ? `Avoir: ${commentaire} (initial: ${montantArrondi.toFixed(2)} €, limité à: ${montantEffectif.toFixed(2)} €)`
          : `Avoir: ${commentaire} (initial: ${montantEffectif.toFixed(2)} €)`;
      this.lignes.push({
        produit_id: null,
        nom_produit: libelle,
        quantite: 1,
        prix_unitaire: -montantEffectif,
        unite: '',
        quantite_min: 1,
        is_avoir: true,
      });
      this.showAvoirModal = false;
      this.avoirMontant = 0;
      this.avoirCommentaire = '';
    },

    async ouvrirPaiement() {
      this.lignesPaiement = [{ mode_paiement_id: null, montant: roundToCent(this.total) }];
      this.showPaiementModal = true;
      this.cotisationCheck = null;
      this.emailFactureAnonyme = '';
      const user = this.utilisateurs.find((u) => u.id === this.selectedUtilisateur);
      const estAnonyme = user && (user.username || '').toLowerCase() === 'anonyme';
      if (this.selectedUtilisateur && !estAnonyme) {
        try {
          const data = await fetchCaisseCotisationCheck(this.selectedUtilisateur);
          if (data.success) this.cotisationCheck = data;
        } catch (e) {
          console.error('Erreur vérification cotisation:', e);
        }
      }
    },

    ajouterLignePaiement() {
      this.lignesPaiement.push({ mode_paiement_id: null, montant: 0 });
    },

    supprimerLignePaiement(index) {
      this.lignesPaiement.splice(index, 1);
    },

    /** Vérifier à nouveau si l'adhérent doit cotiser (après changement utilisateur) */
    async checkCotisation() {
      this.cotisationCheck = null;
      if (!this.selectedUtilisateur) return;
      try {
        const data = await fetchCaisseCotisationCheck(this.selectedUtilisateur);
        if (data.success) this.cotisationCheck = data;
      } catch (e) {
        console.error('Erreur vérification cotisation:', e);
      }
    },

    /** Ajouter une ligne cotisation mensuelle (5, 10 ou 15 €) au panier */
    ajouterCotisation(montant) {
      const m = parseFloat(montant);
      if (Number.isNaN(m) || m < 5 || m > 15) return;
      if (this.lignes.some((l) => l.is_cotisation)) return;
      this.lignes.push({
        produit_id: null,
        nom_produit: 'Cotisation mensuelle',
        quantite: 1,
        prix_unitaire: roundToCent(m),
        is_avoir: false,
        is_cotisation: true,
      });
      if (this.lignesPaiement.length) this.lignesPaiement[0].montant = roundToCent(this.total);
    },

    fermerPaiement() {
      this.showPaiementModal = false;
      this.lignesPaiement = [];
    },

    async chargerCommandesUtilisateur() {
      if (!this.selectedUtilisateur) {
        this.commandesUtilisateur = [];
        this.commandeSelectionnee = null;
        return;
      }
      this.loadingCommandes = true;
      try {
        const data = await fetchCaisseCommandesUtilisateur(this.selectedUtilisateur);
        this.commandesUtilisateur = Array.isArray(data) ? data : [];
      } catch (e) {
        console.error('Erreur chargement commandes:', e);
        this.commandesUtilisateur = [];
      } finally {
        this.loadingCommandes = false;
      }
    },

    async chargerCommandeDansPanier(commandeId) {
      this.showModalChargerCommande = false;
      this.commandeACharger = null;
      try {
        const cmd = this.commandesUtilisateur.find((c) => c.id === commandeId);
        const catalogId = cmd?.catalog_id != null ? cmd.catalog_id : null;
        const suffix = catalogId != null ? ` (cde #${commandeId}, cat #${catalogId})` : '';

        const articles = await fetchCaisseCommandeArticles(commandeId);
        const arr = Array.isArray(articles) ? articles : [];
        let count = 0;
        for (const article of arr) {
          if (!article.product_id_caisse) continue;
          const produit = this.produits.find((p) => p.id === article.product_id_caisse);
          if (!produit) continue;
          const qte = parseFloat(article.quantity) || 1;
          const existing = this.lignes.find((l) => l.produit_id === produit.id && !l.is_avoir);
          if (existing) {
            existing.quantite += qte;
            if (suffix && !(existing.nom_produit || '').includes('(cde ')) {
              existing.nom_produit = (existing.nom_produit || '').trimEnd() + suffix;
            }
          } else {
            this.lignes.push({
              produit_id: produit.id,
              nom_produit: (produit.nom || '').trimEnd() + suffix,
              quantite: qte,
              prix_unitaire: parseFloat(produit.prix) || 0,
              unite: produit.unite || 'Pièce',
              quantite_min: parseFloat(produit.quantite_min) || 1,
              is_avoir: false,
            });
          }
          count++;
        }
        this.commandeSelectionnee = commandeId;
        this.selectedCommandeId = null;
        if (count > 0) alert(`Commande #${commandeId} ajoutée au panier (${count} articles)`);
      } catch (e) {
        console.error('Erreur chargement commande:', e);
        alert(e.message || 'Erreur lors du chargement de la commande');
      }
    },

    confirmerChargerCommande(commande) {
      if (!commande) return;
      // Toujours ajouter la commande au panier (sans remplacer) — pas de modale de confirmation
      this.chargerCommandeDansPanier(commande.id);
    },

    annulerChargerCommande() {
      this.showModalChargerCommande = false;
      this.commandeACharger = null;
    },

    async validerVente() {
      if (!this.peutValiderPaiement) {
        this.error = this.totalPaye < this.total
          ? 'Le total des paiements doit couvrir le montant à payer.'
          : 'Veuillez renseigner le mode de paiement pour chaque montant.';
        return;
      }
      this.error = null;
      try {
        const selectedUser = this.utilisateurs.find((u) => u.id === this.selectedUtilisateur);
        const nomClient = selectedUser?.username || 'Anonyme';
        const estAnonyme = selectedUser && (selectedUser.username || '').toLowerCase() === 'anonyme';
        const venteData = await postCaisseVente({
          adherent_id: estAnonyme ? null : (this.selectedUtilisateur || null),
          nom_client: nomClient,
          lignes: this.lignes,
          montant_ttc: this.total,
        });
        if (!venteData.success) throw new Error(venteData.error);
        for (const ligne of this.lignesPaiement) {
          const montant = roundToCent(parseFloat(ligne.montant) || 0);
          if (montant <= 0 || !ligne.mode_paiement_id) continue;
          await postCaissePaiement({
            vente_id: venteData.vente.id,
            mode_paiement_id: ligne.mode_paiement_id,
            montant,
          });
        }
        if (this.currentPanierId) this.supprimerPanier(this.currentPanierId);
        this.viderPanier();
        this.fermerPaiement();
        const emailDestinataire = estAnonyme
          ? (this.emailFactureAnonyme || '').trim()
          : (selectedUser?.email || '').trim();
        if (emailDestinataire) {
          try {
            await postCaisseEnvoyerFacture(venteData.vente.id, emailDestinataire);
            alert(`Vente enregistrée ! Ticket n°${venteData.vente.numero_ticket}. Ticket envoyé par email au destinataire.`);
          } catch (errEmail) {
            alert(`Vente enregistrée (Ticket n°${venteData.vente.numero_ticket}). L'envoi du ticket par email a échoué : ${errEmail.message}`);
          }
          if (estAnonyme) this.emailFactureAnonyme = '';
        } else {
          alert(`Vente enregistrée ! Ticket n°${venteData.vente.numero_ticket}`);
        }
      } catch (e) {
        this.error = e.message;
        alert('Erreur : ' + e.message);
      }
    },
  },
});
