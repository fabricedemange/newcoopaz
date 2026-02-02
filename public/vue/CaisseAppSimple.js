// Version simplifiée : paniers en localStorage, ventes directes dans DB
// Pas besoin de modifier panier_articles !

(function() {
  console.log('🚀 Chargement de CaisseApp (version simple)...');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  const { createApp, reactive, computed } = Vue;

  // Helper localStorage pour paniers sauvegardés
  const STORAGE_KEY = 'caisse_paniers_sauvegardes';

  const getPaniersSauvegardes = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Erreur lecture localStorage:', e);
      return [];
    }
  };

  const savePaniersSauvegardes = (paniers) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(paniers));
    } catch (e) {
      console.error('Erreur écriture localStorage:', e);
    }
  };

  const app = createApp({
    setup() {
      // État réactif
      const state = reactive({
        // Produits
        produits: [],
        categories: [],
        searchQuery: '',
        selectedCategorie: null,
        produitsLoading: false,

        // Utilisateurs
        utilisateurs: [],
        selectedUtilisateur: null,

        // Panier actuel
        lignes: [],
        currentPanierId: null, // ID local du panier (timestamp)

        // Paniers sauvegardés (localStorage)
        savedPaniers: getPaniersSauvegardes(),
        showPaniersModal: false,

        // Avoirs
        showAvoirModal: false,
        avoirMontant: 0,
        avoirCommentaire: '',

        // Modales paiement
        showPaiementModal: false,
        montantPaiement: 0,
        modePaiementId: null,
        modesPaiement: [],

        error: null
      });

      // Computed
      const produitsFiltrés = computed(() => {
        let filtered = state.produits;

        if (state.searchQuery) {
          filtered = filtered.filter(p =>
            p.nom.toLowerCase().includes(state.searchQuery.toLowerCase())
          );
        }

        if (state.selectedCategorie) {
          filtered = filtered.filter(p => p.category_id === state.selectedCategorie);
        }

        return filtered;
      });

      const total = computed(() => {
        return state.lignes.reduce((sum, ligne) => {
          return sum + (ligne.quantite * ligne.prix_unitaire);
        }, 0);
      });

      const nombreArticles = computed(() => {
        return state.lignes.length;
      });

      const categoriesFiltrées = computed(() => {
        let produitsRecherche = state.produits;

        if (state.searchQuery) {
          produitsRecherche = produitsRecherche.filter(p =>
            p.nom.toLowerCase().includes(state.searchQuery.toLowerCase())
          );
        }

        const categoryIds = new Set(
          produitsRecherche
            .filter(p => p.category_id)
            .map(p => p.category_id)
        );

        return state.categories.filter(c => categoryIds.has(c.id));
      });

      // Méthodes produits
      const chargerProduits = async () => {
        state.produitsLoading = true;
        try {
          const response = await fetch('/api/caisse/produits', {
            credentials: 'include'
          });
          const data = await response.json();

          if (data.success) {
            state.produits = data.produits;
            state.categories = data.categories;
          }
        } catch (error) {
          console.error('Erreur chargement produits:', error);
        } finally {
          state.produitsLoading = false;
        }
      };

      const chargerUtilisateurs = async () => {
        try {
          const response = await fetch('/api/caisse/utilisateurs', {
            credentials: 'include'
          });
          const data = await response.json();

          if (data.success) {
            state.utilisateurs = data.utilisateurs;
            // Sélectionner Anonyme par défaut
            const anonyme = data.utilisateurs.find(u => u.username.toLowerCase() === 'anonyme');
            if (anonyme) {
              state.selectedUtilisateur = anonyme.id;
            }
          }
        } catch (error) {
          console.error('Erreur chargement utilisateurs:', error);
        }
      };

      const ajouterProduit = (produit) => {
        const ligneExistante = state.lignes.find(l => l.produit_id === produit.id);

        if (ligneExistante) {
          ligneExistante.quantite += parseFloat(produit.quantite_min) || 1;
        } else {
          state.lignes.push({
            produit_id: produit.id,
            nom_produit: produit.nom,
            quantite: parseFloat(produit.quantite_min) || 1,
            prix_unitaire: parseFloat(produit.prix) || 0,
            unite: produit.unite || 'Pièce',
            quantite_min: parseFloat(produit.quantite_min) || 1,
            is_avoir: false
          });
        }
      };

      const modifierQuantite = (index, nouvelleQuantite) => {
        const ligne = state.lignes[index];
        if (ligne && nouvelleQuantite > 0) {
          ligne.quantite = parseFloat(nouvelleQuantite);
        }
      };

      const supprimerLigne = (index) => {
        state.lignes.splice(index, 1);
      };

      const viderPanier = () => {
        state.lignes = [];
        state.currentPanierId = null;
      };

      // Méthodes paniers sauvegardés (localStorage)
      const sauvegarderPanier = () => {
        if (state.lignes.length === 0) {
          alert('Le panier est vide');
          return;
        }

        const panier = {
          id: state.currentPanierId || Date.now(),
          lignes: JSON.parse(JSON.stringify(state.lignes)),
          selectedUtilisateur: state.selected Utilisateur,
          saved_at: new Date().toISOString(),
          total: total.value
        };

        let paniers = getPaniersSauvegardes();

        // Update ou ajout
        const existingIndex = paniers.findIndex(p => p.id === panier.id);
        if (existingIndex >= 0) {
          paniers[existingIndex] = panier;
        } else {
          paniers.push(panier);
        }

        savePaniersSauvegardes(paniers);
        state.savedPaniers = paniers;
        state.currentPanierId = panier.id;

        alert('Panier sauvegardé !');
      };

      const chargerPanier = (panierId) => {
        const paniers = getPaniersSauvegardes();
        const panier = paniers.find(p => p.id === panierId);

        if (panier) {
          state.lignes = JSON.parse(JSON.stringify(panier.lignes));
          state.selectedUtilisateur = panier.selectedUtilisateur;
          state.currentPanierId = panier.id;
          state.showPaniersModal = false;
          alert('Panier chargé !');
        }
      };

      const supprimerPanier = (panierId) => {
        if (!confirm('Supprimer ce panier sauvegardé ?')) return;

        let paniers = getPaniersSauvegardes();
        paniers = paniers.filter(p => p.id !== panierId);
        savePaniersSauvegardes(paniers);
        state.savedPaniers = paniers;

        if (state.currentPanierId === panierId) {
          viderPanier();
        }

        alert('Panier supprimé');
      };

      const nouveauPanier = () => {
        if (state.lignes.length > 0) {
          if (!confirm('Effacer le panier actuel ?')) return;
        }
        viderPanier();
      };

      // Méthodes avoirs
      const ajouterAvoir = () => {
        const montant = parseFloat(state.avoirMontant);

        if (!montant || montant <= 0) {
          alert('Montant invalide');
          return;
        }

        // Validation côté client
        const totalProduits = state.lignes
          .filter(l => !l.is_avoir)
          .reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);

        const totalAvoirs = state.lignes
          .filter(l => l.is_avoir)
          .reduce((sum, l) => sum + Math.abs(l.prix_unitaire), 0);

        if (totalAvoirs + montant > totalProduits) {
          alert(`Le total des avoirs (${(totalAvoirs + montant).toFixed(2)}€) ne peut pas dépasser le total des produits (${totalProduits.toFixed(2)}€)`);
          return;
        }

        // Ajouter avoir dans le panier
        state.lignes.push({
          produit_id: null,
          nom_produit: `Avoir: ${state.avoirCommentaire || 'Remboursement'}`,
          quantite: 1,
          prix_unitaire: -montant,
          unite: '',
          quantite_min: 1,
          is_avoir: true
        });

        state.showAvoirModal = false;
        state.avoirMontant = 0;
        state.avoirCommentaire = '';
      };

      // Méthodes paiement
      const chargerModesPaiement = async () => {
        try {
          const response = await fetch('/api/caisse/modes-paiement', {
            credentials: 'include'
          });
          const data = await response.json();

          if (data.success) {
            state.modesPaiement = data.modes_paiement;
          }
        } catch (error) {
          console.error('Erreur chargement modes paiement:', error);
        }
      };

      const ouvrirPaiement = () => {
        state.montantPaiement = total.value;
        state.showPaiementModal = true;
      };

      const validerVente = async () => {
        if (!state.modePaiementId) {
          alert('Veuillez sélectionner un mode de paiement');
          return;
        }

        try {
          // 1. Créer la vente
          const venteResponse = await fetch('/api/caisse/ventes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              adherent_id: state.selectedUtilisateur || null,
              nom_client: state.utilisateurs.find(u => u.id === state.selectedUtilisateur)?.username || 'Anonyme',
              lignes: state.lignes,
              montant_ttc: total.value
            })
          });

          const venteData = await venteResponse.json();
          if (!venteData.success) throw new Error(venteData.error);

          // 2. Créer le paiement
          const paiementResponse = await fetch('/api/caisse/paiements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              vente_id: venteData.vente.id,
              mode_paiement_id: state.modePaiementId,
              montant: state.montantPaiement
            })
          });

          const paiementData = await paiementResponse.json();
          if (!paiementData.success) throw new Error(paiementData.error);

          // 3. Succès - supprimer du localStorage si c'était un panier sauvegardé
          if (state.currentPanierId) {
            supprimerPanier(state.currentPanierId);
          }

          alert(`Vente enregistrée ! Ticket n°${venteData.vente.numero_ticket}`);
          viderPanier();
          state.showPaiementModal = false;
          state.modePaiementId = null;

        } catch (error) {
          state.error = error.message;
          alert('Erreur : ' + error.message);
        }
      };

      // Chargement initial
      chargerProduits();
      chargerUtilisateurs();
      chargerModesPaiement();

      return {
        state,
        produitsFiltrés,
        categoriesFiltrées,
        total,
        nombreArticles,
        ajouterProduit,
        modifierQuantite,
        supprimerLigne,
        viderPanier,
        sauvegarderPanier,
        chargerPanier,
        supprimerPanier,
        nouveauPanier,
        ajouterAvoir,
        ouvrirPaiement,
        validerVente
      };
    },

    // ... Le reste du template reste identique au CaisseApp.js
  });

  app.mount('#caisse-app');
})();
