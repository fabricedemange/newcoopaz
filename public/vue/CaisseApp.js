(function() {
  console.log('🚀 Chargement de CaisseApp.js...');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  const { createApp, reactive, computed } = Vue;

  const app = createApp({
    setup() {
      // État réactif (remplace Pinia store cart.js)
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

        // Panier (équivalent cart store)
        lignes: [],

        // Gestion paniers sauvegardés
        currentPanierId: null,
        savedPaniers: [],
        showPaniersModal: false,
        paniersLoading: false,

        // Gestion avoirs
        showAvoirModal: false,
        avoirMontant: 0,
        avoirCommentaire: '',

        // Modales
        showPaiementModal: false,
        montantPaiement: 0,
        modePaiementId: null,
        modesPaiement: [],

        // NOUVEAU : Gestion commandes catalogue
        commandesUtilisateur: [],
        commandeSelectionnee: null,
        loadingCommandes: false,
        showModalChargerCommande: false,
        commandeACharger: null,

        error: null
      });

      // Fonction utilitaire pour arrondir au centime supérieur
      const roundToCent = (amount) => {
        // Arrondir au centime le plus proche (2 décimales)
        return Math.round(amount * 100) / 100;
      };

      // Fonction pour calculer le montant d'une ligne (quantité × prix)
      const calculateLineTotal = (quantite, prixUnitaire) => {
        return roundToCent(quantite * prixUnitaire);
      };

      // Computed (équivalent Pinia getters)
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
        const sum = state.lignes.reduce((acc, ligne) => {
          return acc + calculateLineTotal(ligne.quantite, ligne.prix_unitaire);
        }, 0);
        return roundToCent(sum);
      });

      const nombreArticles = computed(() => {
        return state.lignes.length;
      });

      const categoriesFiltrées = computed(() => {
        // 1. Filtrer d'abord les produits par recherche uniquement
        let produitsRecherche = state.produits;

        if (state.searchQuery) {
          produitsRecherche = produitsRecherche.filter(p =>
            p.nom.toLowerCase().includes(state.searchQuery.toLowerCase())
          );
        }

        // 2. Extraire les catégories uniques des produits filtrés
        const categoryIds = new Set(
          produitsRecherche
            .filter(p => p.category_id)
            .map(p => p.category_id)
        );

        // 3. Retourner les catégories correspondantes
        return state.categories.filter(c => categoryIds.has(c.id));
      });

      // Méthodes (équivalent Pinia actions)
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
          state.error = error.message;
        } finally {
          state.produitsLoading = false;
        }
      };

      const chargerModesPaiement = async () => {
        try {
          const response = await fetch('/api/caisse/modes-paiement', {
            credentials: 'include'
          });
          const data = await response.json();
          if (data.success) {
            state.modesPaiement = data.modes;
            console.log('✅ Modes paiement chargés:', data.modes);
          } else {
            console.error('❌ Erreur chargement modes paiement:', data.error);
          }
        } catch (error) {
          console.error('❌ Exception chargement modes paiement:', error);
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
            // Sélectionner "Anonyme" par défaut
            const anonyme = state.utilisateurs.find(u => u.username.toLowerCase() === 'anonyme');
            if (anonyme) {
              state.selectedUtilisateur = anonyme.id;
            }
          }
        } catch (error) {
          console.error('Erreur chargement utilisateurs:', error);
        }
      };

      const ajouterProduit = (produit, quantite = 1) => {
        const existing = state.lignes.find(l => l.produit_id === produit.id);

        if (existing) {
          const quantiteMin = parseFloat(existing.quantite_min) || 1;
          existing.quantite = parseFloat(existing.quantite) + quantiteMin;
        } else {
          state.lignes.push({
            produit_id: produit.id,
            nom_produit: produit.nom,
            quantite: parseFloat(produit.quantite_min) || 1,
            prix_unitaire: parseFloat(produit.prix),
            image_url: produit.image_url,
            unite: produit.unite || 'Pièce',
            quantite_min: parseFloat(produit.quantite_min) || 1
          });
        }
      };

      // Fonction pour ajuster automatiquement les avoirs si leur total dépasse le total des produits
      const ajusterAvoirsApresSuppression = () => {
        // Calculer le total des produits (hors avoirs)
        const totalProduits = roundToCent(
          state.lignes
            .filter(l => !l.is_avoir)
            .reduce((sum, l) => sum + calculateLineTotal(l.quantite, l.prix_unitaire), 0)
        );

        // Calculer le total des avoirs
        const totalAvoirs = roundToCent(
          state.lignes
            .filter(l => l.is_avoir)
            .reduce((sum, l) => sum + Math.abs(l.prix_unitaire), 0)
        );

        // Si les avoirs dépassent le total des produits, les ajuster
        if (totalAvoirs > totalProduits) {
          // Cas spécial: s'il n'y a plus de produits, supprimer tous les avoirs
          if (totalProduits === 0) {
            state.lignes = state.lignes.filter(l => !l.is_avoir);
          } else {
            // Sinon, ajuster tous les avoirs proportionnellement pour atteindre totalProduits
            const avoirsList = state.lignes.filter(l => l.is_avoir);

            if (avoirsList.length > 0) {
              const facteurAjustement = totalProduits / totalAvoirs;

              avoirsList.forEach(avoir => {
                const montantActuel = Math.abs(avoir.prix_unitaire);
                const nouveauMontant = roundToCent(montantActuel * facteurAjustement);

                // Si l'avoir est ajusté (réduit) et non nul, ajouter la mention de la valeur d'origine
                if (nouveauMontant > 0 && nouveauMontant < montantActuel) {
                  // Vérifier si le commentaire contient déjà "(initialement"
                  if (!avoir.nom_produit.includes('(initialement')) {
                    avoir.nom_produit = `${avoir.nom_produit} (initialement ${montantActuel.toFixed(2)}€)`;
                  }
                }

                avoir.prix_unitaire = -nouveauMontant;
              });
            }
          }
        }

        // Supprimer automatiquement les avoirs devenus nuls ou quasi-nuls
        state.lignes = state.lignes.filter(l =>
          !l.is_avoir || Math.abs(l.prix_unitaire) >= 0.01
        );
      };

      const modifierQuantite = (index, quantite) => {
        const qty = parseFloat(quantite);
        if (qty <= 0) {
          state.lignes.splice(index, 1);
        } else {
          state.lignes[index].quantite = qty;
        }

        // Après modification de quantité, vérifier et ajuster les avoirs si nécessaire
        ajusterAvoirsApresSuppression();
      };

      const viderPanier = () => {
        state.lignes = [];
      };

      const ouvrirPaiement = async () => {
        if (state.lignes.length === 0) {
          alert('Le panier est vide');
          return;
        }

        state.montantPaiement = total.value;

        // Charger modes paiement si pas encore fait (et attendre)
        if (state.modesPaiement.length === 0) {
          await chargerModesPaiement();
        }

        state.showPaiementModal = true;
      };

      const validerVente = async () => {
        console.log('🔵 validerVente appelée');
        console.log('Mode paiement ID:', state.modePaiementId);
        console.log('Lignes:', state.lignes);
        console.log('Total:', total.value);

        // Vérifier mode de paiement seulement si montant > 0
        if (total.value > 0 && !state.modePaiementId) {
          alert('Veuillez sélectionner un mode de paiement');
          return;
        }

        try {
          console.log('🟢 Début création vente');
          // 1. Créer la vente
          const venteResponse = await fetch('/api/caisse/ventes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CSRF-Token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              adherent_id: state.selectedUtilisateur || null,
              nom_client: state.utilisateurs.find(u => u.id === state.selectedUtilisateur)?.username || 'Anonyme',
              lignes: state.lignes,
              montant_ttc: total.value,
              panier_id: state.commandeSelectionnee || null
            })
          });

          const venteData = await venteResponse.json();
          if (!venteData.success) throw new Error(venteData.error);

          // 2. Créer le paiement seulement si montant > 0
          if (total.value > 0) {
            const paiementResponse = await fetch('/api/caisse/paiements', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': window.CSRF_TOKEN
              },
              credentials: 'include',
              body: JSON.stringify({
                vente_id: venteData.vente.id,
                mode_paiement_id: state.modePaiementId,
                montant: state.montantPaiement
              })
            });

            const paiementData = await paiementResponse.json();
            if (!paiementData.success) throw new Error(paiementData.error);
          }

          // 3. Si c'était un panier chargé, le supprimer des drafts
          if (state.currentPanierId) {
            await fetch(`/api/caisse/paniers/${state.currentPanierId}`, {
              method: 'DELETE',
              headers: {
                'CSRF-Token': window.CSRF_TOKEN
              },
              credentials: 'include'
            });
          }

          // 4. Succès
          alert(`Vente enregistrée ! Ticket n°${venteData.vente.numero_ticket}`);
          viderPanier();
          state.showPaiementModal = false;
          state.modePaiementId = null;
          state.currentPanierId = null;
          state.commandeSelectionnee = null;
          state.commandesUtilisateur = [];
          await chargerPaniersSauvegardes(); // Rafraîchir la liste

        } catch (error) {
          state.error = error.message;
          alert('Erreur : ' + error.message);
        }
      };

      // ==================================================
      // NOUVELLES MÉTHODES: Gestion paniers sauvegardés
      // ==================================================

      const chargerPaniersSauvegardes = async () => {
        state.paniersLoading = true;
        try {
          const response = await fetch('/api/caisse/paniers', {
            credentials: 'include'
          });
          const data = await response.json();

          if (data.success) {
            state.savedPaniers = data.paniers;
          }
        } catch (error) {
          console.error('Erreur chargement paniers:', error);
        } finally {
          state.paniersLoading = false;
        }
      };

      const sauvegarderPanier = async () => {
        if (state.lignes.length === 0) {
          alert('Le panier est vide');
          return;
        }

        try {
          const url = state.currentPanierId
            ? `/api/caisse/paniers/${state.currentPanierId}`
            : '/api/caisse/paniers';
          const method = state.currentPanierId ? 'PUT' : 'POST';

          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'CSRF-Token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              lignes: state.lignes.map(l => ({
                produit_id: l.produit_id,
                nom_produit: l.nom_produit,
                quantite: l.quantite,
                prix_unitaire: l.prix_unitaire,
                unite: l.unite,
                quantite_min: l.quantite_min,
                is_avoir: l.is_avoir || false
              })),
              selectedUtilisateur: state.selectedUtilisateur
            })
          });

          const data = await response.json();
          if (data.success) {
            state.currentPanierId = null;
            alert('Panier sauvegardé !');
            await chargerPaniersSauvegardes();
            viderPanier();
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          alert('Erreur : ' + error.message);
        }
      };

      const chargerPanier = async (panierId) => {
        try {
          const response = await fetch(`/api/caisse/paniers/${panierId}`, {
            credentials: 'include'
          });
          const data = await response.json();

          if (data.success) {
            state.lignes = data.lignes;
            state.selectedUtilisateur = data.selectedUtilisateur;
            state.currentPanierId = panierId;
            state.showPaniersModal = false;
            alert('Panier chargé !');
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          alert('Erreur : ' + error.message);
        }
      };

      const supprimerPanier = async (panierId) => {
        if (!confirm('Supprimer ce panier sauvegardé ?')) return;

        try {
          const response = await fetch(`/api/caisse/paniers/${panierId}`, {
            method: 'DELETE',
            headers: {
              'CSRF-Token': window.CSRF_TOKEN
            },
            credentials: 'include'
          });
          const data = await response.json();

          if (data.success) {
            if (state.currentPanierId === panierId) {
              viderPanier();
              state.currentPanierId = null;
            }
            await chargerPaniersSauvegardes();
            alert('Panier supprimé');
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          alert('Erreur : ' + error.message);
        }
      };

      const nouveauPanier = () => {
        if (state.lignes.length > 0) {
          if (!confirm('Effacer le panier actuel ?')) return;
        }
        viderPanier();
        state.currentPanierId = null;
      };

      // ==================================================
      // NOUVELLES MÉTHODES: Chargement commandes catalogue
      // ==================================================

      const chargerCommandesUtilisateur = async () => {
        if (!state.selectedUtilisateur) {
          state.commandesUtilisateur = [];
          state.commandeSelectionnee = null;
          return;
        }

        state.loadingCommandes = true;

        try {
          const response = await fetch(
            `/api/caisse/commandes-utilisateur?user_id=${state.selectedUtilisateur}`,
            { credentials: 'include' }
          );

          if (!response.ok) throw new Error('Erreur chargement commandes');

          const commandes = await response.json();
          state.commandesUtilisateur = commandes;

        } catch (error) {
          console.error('Erreur:', error);
          alert('Erreur lors du chargement des commandes');
        } finally {
          state.loadingCommandes = false;
        }
      };

      const confirmerChargerCommande = (commande) => {
        if (!commande) return;

        // Si panier déjà rempli, demander confirmation
        if (state.lignes.length > 0) {
          state.commandeACharger = commande;
          state.showModalChargerCommande = true;
        } else {
          chargerCommandeDansPanier(commande.id);
        }
      };

      const chargerCommandeDansPanier = async (commandeId) => {
        state.showModalChargerCommande = false;

        try {
          const response = await fetch(
            `/api/caisse/commandes/${commandeId}/articles`,
            { credentials: 'include' }
          );

          if (!response.ok) throw new Error('Erreur chargement articles');

          const articles = await response.json();

          // Vider le panier actuel
          state.lignes = [];

          // Ajouter chaque article au panier
          let articlesCharges = 0;
          for (const article of articles) {
            if (!article.product_id_caisse) {
              console.warn(`Produit caisse non trouvé pour catalog_product ${article.catalog_product_id}`);
              continue;
            }

            // Trouver le produit dans la liste des produits
            const produit = state.produits.find(p => p.id === article.product_id_caisse);

            if (!produit) {
              console.warn(`Produit ${article.product_id_caisse} non trouvé dans produits caisse`);
              continue;
            }

            // Ajouter le produit avec la quantité de la commande
            state.lignes.push({
              produit_id: produit.id,
              nom_produit: produit.nom,
              quantite: parseFloat(article.quantity),
              prix_unitaire: parseFloat(produit.prix),
              image_url: produit.image_url,
              unite: produit.unite || 'Pièce',
              quantite_min: parseFloat(produit.quantite_min) || 1
            });

            articlesCharges++;
          }

          // Stocker l'ID de la commande source
          state.commandeSelectionnee = commandeId;

          alert(`Commande #${commandeId} chargée dans le panier (${articlesCharges} articles)`);

        } catch (error) {
          console.error('Erreur:', error);
          alert('Erreur lors du chargement de la commande');
        }
      };

      const annulerChargerCommande = () => {
        state.showModalChargerCommande = false;
        state.commandeACharger = null;
      };

      // ==================================================
      // NOUVELLES MÉTHODES: Gestion avoirs
      // ==================================================

      const ajouterAvoir = async () => {
        const montant = parseFloat(state.avoirMontant);

        if (!montant || montant <= 0) {
          alert('Montant invalide');
          return;
        }

        // Validation côté client
        const totalProduits = roundToCent(
          state.lignes
            .filter(l => !l.is_avoir)
            .reduce((sum, l) => sum + calculateLineTotal(l.quantite, l.prix_unitaire), 0)
        );

        const totalAvoirs = roundToCent(
          state.lignes
            .filter(l => l.is_avoir)
            .reduce((sum, l) => sum + Math.abs(l.prix_unitaire), 0)
        );

        if (roundToCent(totalAvoirs + montant) > totalProduits) {
          alert(`Le total des avoirs (${roundToCent(totalAvoirs + montant).toFixed(2)}€) ne peut pas dépasser le total des produits (${totalProduits.toFixed(2)}€)`);
          return;
        }

        // Ajouter avoir directement dans le panier (pas d'API)
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

      const supprimerLigne = (index) => {
        state.lignes.splice(index, 1);

        // Après suppression, vérifier et ajuster les avoirs si nécessaire
        ajusterAvoirsApresSuppression();
      };

      // Chargement initial
      chargerProduits();
      chargerUtilisateurs();
      chargerPaniersSauvegardes();
      chargerModesPaiement();

      // Watcher: Charger les commandes quand l'utilisateur change
      const { watch } = Vue;
      watch(() => state.selectedUtilisateur, (newUserId) => {
        if (newUserId) {
          chargerCommandesUtilisateur();
        } else {
          state.commandesUtilisateur = [];
          state.commandeSelectionnee = null;
        }
      });

      return {
        state,
        produitsFiltrés,
        categoriesFiltrées,
        total,
        nombreArticles,
        ajouterProduit,
        modifierQuantite,
        viderPanier,
        ouvrirPaiement,
        validerVente,
        // Nouvelles méthodes paniers
        chargerPaniersSauvegardes,
        sauvegarderPanier,
        chargerPanier,
        supprimerPanier,
        nouveauPanier,
        // Nouvelles méthodes commandes catalogue
        chargerCommandesUtilisateur,
        confirmerChargerCommande,
        chargerCommandeDansPanier,
        annulerChargerCommande,
        // Nouvelles méthodes avoirs
        ajouterAvoir,
        supprimerLigne,
        // Fonctions utilitaires
        roundToCent,
        calculateLineTotal
      };
    },

    methods: {
      updateDOM() {
        const container = this.$refs.container;
        if (!container) return;

        // Sauvegarder le focus et position curseur
        const activeElement = document.activeElement;
        const isSearchFocused = activeElement && activeElement.classList.contains('search-input');
        const cursorPosition = isSearchFocused ? activeElement.selectionStart : 0;

        const s = this.state;
        let html = '<div class="admin-content-wrapper"><div class="container-fluid px-3 mt-4">';

        // Bouton retour mobile (style CoopazV13)
        html += `
          <button class="btn btn-outline-secondary d-md-none mb-3" onclick="window.history.back()">
            <i class="bi bi-arrow-left me-2"></i>Retour
          </button>
        `;

        // Header avec titre (style CoopazV13)
        html += `
        <div class="row mb-4">
          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center">
              <h2 class="mb-0"><i class="bi bi-cart-fill me-2"></i>Caisse</h2>
              <a href="/caisse/historique" class="btn btn-outline-primary">
                <i class="bi bi-clock-history me-2"></i>Historique des ventes
              </a>
            </div>
          </div>
        </div>`;

        // Layout 2 colonnes: Produits (7) + Panier (5)
        html += '<div class="row">';

        // === COLONNE PRODUITS (7/12) ===
        html += '<div class="col-lg-7 col-md-7 mb-4">';

        // Barre recherche
        html += `
        <div class="mb-3">
          <input type="text"
                 class="form-control search-input"
                 placeholder="🔍 Rechercher un produit..."
                 value="${s.searchQuery}"
                 style="max-width: 500px;">
        </div>`;

        // Indicateur nombre produits
        html += `
        <div class="mb-3">
          <span class="badge bg-secondary fs-6 py-2 px-3">
            <i class="bi bi-box-seam me-1"></i>${this.produitsFiltrés.length} produits disponibles
          </span>
        </div>`;

        // Afficher les catégories filtrées si recherche active
        if (s.searchQuery && this.categoriesFiltrées.length > 0) {
          html += '<div class="mb-3">';
          html += '<div class="d-flex flex-wrap gap-2">';
          this.categoriesFiltrées.forEach(cat => {
            const isSelected = s.selectedCategorie === cat.id;
            html += `
              <button class="btn ${isSelected ? 'btn-primary' : 'btn-outline-primary'} btn-sm categorie-badge"
                      data-category-id="${cat.id}">
                ${cat.nom}
                <span class="badge ${isSelected ? 'bg-light text-primary' : 'bg-primary'} ms-2">
                  ${this.produitsFiltrés.filter(p => p.category_id === cat.id).length}
                </span>
              </button>
            `;
          });
          html += '</div></div>';
        }

        if (this.produitsFiltrés.length === 0) {
          html += `
            <div class="alert alert-info text-center">
              <i class="bi bi-info-circle me-2"></i>
              Aucun produit disponible
            </div>`;
        } else {
          html += '<div class="row g-3">';

          this.produitsFiltrés.forEach(produit => {
            html += `
              <div class="col-lg-4 col-md-6 col-sm-4 col-6">
                <div class="card h-100 produit-card" data-produit-id="${produit.id}" style="cursor: pointer;">
                  ${produit.image_url ? `
                    <img src="${produit.image_url}" class="card-img-top" alt="${produit.nom}"
                         style="height: 120px; object-fit: cover;">
                  ` : ''}
                  <div class="card-body p-2">
                    <h6 class="card-title mb-1" style="font-size: 0.9rem;">${produit.nom}</h6>
                    <div class="d-flex justify-content-between align-items-center">
                      <strong class="text-primary">${(parseFloat(produit.prix) || 0).toFixed(2)} €</strong>
                    </div>
                  </div>
                </div>
              </div>
            `;
          });

          html += '</div>';
        }

        html += '</div>';

        // === COLONNE PANIER (5/12) - Auto Height ===
        html += '<div class="col-lg-5 col-md-5">';
        html += '<div class="card" style="min-height: calc(100vh - 120px); display: flex; flex-direction: column;">';
        html += '<div class="card-header bg-primary text-white">';
        html += '<div class="d-flex justify-content-between align-items-center mb-2">';
        html += '<h5 class="mb-0"><i class="bi bi-cart3 me-2"></i>Panier</h5>';
        html += '</div>';

        // Boutons gestion paniers
        html += '<div class="d-flex gap-2 flex-wrap">';
        html += '<button class="btn btn-sm btn-outline-light nouveau-panier-btn">';
        html += '<i class="bi bi-file-earmark-plus me-1"></i>Nouveau';
        html += '</button>';
        html += `<button class="btn btn-sm btn-light sauvegarder-panier-btn" ${s.lignes.length === 0 ? 'disabled' : ''}>`;
        html += '<i class="bi bi-save me-1"></i>Sauvegarder';
        html += '</button>';
        html += '<button class="btn btn-sm btn-info charger-panier-btn">';
        html += '<i class="bi bi-folder2-open me-1"></i>Charger';
        html += `<span class="badge bg-white text-info ms-1">${s.savedPaniers.length}</span>`;
        html += '</button>';
        html += '</div>';

        // Dropdown utilisateur dans le header
        html += '<div class="mt-3">';
        html += '<label class="form-label mb-1 small"><i class="bi bi-person me-1"></i>Utilisateur</label>';
        html += '<select class="form-select form-select-sm utilisateur-select">';
        html += this.state.utilisateurs.map(u => `
          <option value="${u.id}" ${s.selectedUtilisateur === u.id ? 'selected' : ''}>
            ${u.username}
          </option>
        `).join('');
        html += '</select>';
        html += '</div>';

        html += '</div>';
        html += '<div class="card-body" style="flex: 1;">';

        // Dropdown Commandes Catalogue (si utilisateur sélectionné)
        if (s.selectedUtilisateur) {
          html += '<div class="mb-3 border-bottom pb-3">';
          html += '<label class="form-label fw-bold small mb-2">';
          html += '<i class="bi bi-basket me-1"></i>Charger une commande catalogue';
          html += '</label>';

          html += '<button class="btn btn-sm btn-outline-primary w-100 mb-2 actualiser-commandes-btn"';
          html += s.loadingCommandes ? ' disabled' : '';
          html += '>';
          html += '<i class="bi bi-arrow-clockwise me-1"></i>';
          html += s.loadingCommandes ? 'Chargement...' : 'Actualiser commandes';
          html += '</button>';

          html += '<select class="form-select form-select-sm commande-select"';
          html += s.commandesUtilisateur.length === 0 ? ' disabled' : '';
          html += '>';
          html += '<option value="">-- Sélectionner une commande --</option>';
          s.commandesUtilisateur.forEach(cmd => {
            html += `<option value="${cmd.id}">`;
            html += `Cde #${cmd.id} - ${cmd.catalogue_nom} (Cat #${cmd.catalog_id}) | `;
            html += `${cmd.nb_articles} articles | ${parseFloat(cmd.total || 0).toFixed(2)}€`;
            html += '</option>';
          });
          html += '</select>';

          if (s.commandesUtilisateur.length === 0 && !s.loadingCommandes) {
            html += '<small class="text-muted d-block mt-1">Aucune commande en attente pour cet utilisateur</small>';
          }

          html += '</div>';
        }

        // Indicateur commande chargée
        if (s.commandeSelectionnee) {
          html += '<div class="alert alert-info py-2 px-3 mb-3" style="font-size: 0.85rem;">';
          html += '<i class="bi bi-info-circle me-1"></i>';
          html += `Ce panier provient de la commande catalogue #${s.commandeSelectionnee}`;
          html += '</div>';
        }

        // Bouton ajouter avoir
        if (s.lignes.length > 0) {
          html += '<button class="btn btn-sm btn-warning w-100 mb-2 ajouter-avoir-btn">';
          html += '<i class="bi bi-receipt me-1"></i>Ajouter un avoir';
          html += '</button>';
        }

        if (s.lignes.length === 0) {
          html += `
            <div class="text-center py-4 text-muted">
              <i class="bi bi-cart-x" style="font-size: 3rem;"></i>
              <p class="mt-2 mb-0">Panier vide</p>
            </div>`;
        } else {
          // Liste articles
          html += '<div class="mb-3">';

          s.lignes.forEach((ligne, index) => {
            const isAvoir = ligne.is_avoir || ligne.produit_id === null;

            html += `
              <div class="border-bottom pb-2 mb-2 ${isAvoir ? 'bg-warning bg-opacity-10' : ''}">
                <div class="d-flex justify-content-between align-items-start mb-1">
                  <strong style="font-size: 0.9rem;" class="${isAvoir ? 'text-warning' : ''}">
                    ${isAvoir ? '<i class="bi bi-receipt me-1"></i>' : ''}${ligne.nom_produit}
                  </strong>
                  <button class="btn btn-sm btn-outline-danger retirer-btn" data-index="${index}">
                    <i class="bi bi-x-lg"></i>
                  </button>
                </div>`;

            if (isAvoir) {
              // Pour un avoir, afficher juste le montant
              html += `
                <div class="d-flex justify-content-end align-items-center">
                  <strong class="text-warning">${ligne.prix_unitaire.toFixed(2)} €</strong>
                </div>`;
            } else {
              // Pour un produit normal, afficher quantité et prix
              html += `
                <div class="d-flex justify-content-between align-items-center">
                  <div class="d-flex align-items-center gap-1">
                    <button class="btn btn-outline-secondary btn-sm decrement-btn" type="button" data-index="${index}">
                      <i class="bi bi-dash"></i>
                    </button>
                    <input type="number" class="form-control form-control-sm text-center quantite-input"
                           data-index="${index}" value="${parseFloat(ligne.quantite).toFixed(3)}" min="0.001" step="0.001" style="width: 60px;">
                    <button class="btn btn-outline-secondary btn-sm increment-btn" type="button" data-index="${index}">
                      <i class="bi bi-plus"></i>
                    </button>
                    <span class="text-muted small">${ligne.unite || 'Pièce'}</span>
                  </div>
                  <span class="text-muted">
                    ${parseFloat(ligne.quantite).toFixed(3)} ${ligne.unite || 'kg'} × ${ligne.prix_unitaire.toFixed(2)}€ =
                    <strong class="text-primary">${this.calculateLineTotal(ligne.quantite, ligne.prix_unitaire).toFixed(2)} €</strong>
                  </span>
                </div>`;
            }

            html += '</div>';
          });

          html += '</div>';

          // Total
          html += `
            <div class="border-top pt-3 mb-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted">Articles:</span>
                <span>${this.nombreArticles}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Total:</h5>
                <h5 class="mb-0 text-primary">${this.total.toFixed(2)} €</h5>
              </div>
            </div>`;

          // Boutons actions
          html += `
            <div class="d-grid gap-2">
              <button class="btn btn-success btn-lg valider-btn">
                <i class="bi bi-check-circle me-2"></i>Valider la vente
              </button>
              <button class="btn btn-outline-danger vider-btn">
                <i class="bi bi-trash me-2"></i>Vider le panier
              </button>
            </div>`;
        }

        html += '</div></div></div>';
        html += '</div></div></div>';

        // === MODAL PANIERS SAUVEGARDÉS ===
        if (s.showPaniersModal) {
          html += `
            <div class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
              <div class="modal-dialog modal-lg">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title"><i class="bi bi-folder2-open me-2"></i>Paniers sauvegardés</h5>
                    <button type="button" class="btn-close close-paniers-modal"></button>
                  </div>
                  <div class="modal-body">`;

          if (s.paniersLoading) {
            html += '<div class="text-center py-4"><div class="spinner-border"></div></div>';
          } else if (s.savedPaniers.length === 0) {
            html += '<div class="alert alert-info">Aucun panier sauvegardé</div>';
          } else {
            s.savedPaniers.forEach(panier => {
              html += `
                <div class="card mb-2">
                  <div class="card-body">
                    <div class="row align-items-center">
                      <div class="col-md-6">
                        <strong>${panier.nb_articles} article(s)</strong>
                        <br>
                        <small class="text-muted">
                          <i class="bi bi-person me-1"></i>${panier.utilisateur_nom || 'Anonyme'}
                        </small>
                        <br>
                        <small class="text-muted">
                          <i class="bi bi-clock me-1"></i>${new Date(panier.saved_at || panier.created_at).toLocaleString('fr-FR')}
                        </small>
                      </div>
                      <div class="col-md-3 text-end">
                        <h5 class="mb-0 text-primary">${panier.total.toFixed(2)} €</h5>
                      </div>
                      <div class="col-md-3 text-end">
                        <button class="btn btn-sm btn-primary charger-panier-id-btn me-2" data-panier-id="${panier.id}">
                          <i class="bi bi-box-arrow-in-down me-1"></i>Charger
                        </button>
                        <button class="btn btn-sm btn-outline-danger supprimer-panier-btn" data-panier-id="${panier.id}">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>`;
            });
          }

          html += `
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary close-paniers-modal">Fermer</button>
                  </div>
                </div>
              </div>
            </div>`;
        }

        // === MODAL PAIEMENT ===
        if (s.showPaiementModal) {
          html += `
            <div class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
              <div class="modal-dialog">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title"><i class="bi bi-credit-card me-2"></i>Valider la vente</h5>
                    <button type="button" class="btn-close close-paiement-modal"></button>
                  </div>
                  <div class="modal-body">
                    <div class="alert alert-success">
                      <i class="bi bi-info-circle me-2"></i>
                      Total à payer: <strong>${this.total.toFixed(2)} €</strong>
                    </div>

                    <div class="mb-3">
                      <label class="form-label">Mode de paiement *</label>
                      <select class="form-select mode-paiement-select">
                        <option value="">-- Sélectionner --</option>
                        ${s.modesPaiement.map(mode => `
                          <option value="${mode.id}" ${s.modePaiementId === mode.id ? 'selected' : ''}>
                            ${mode.nom}
                          </option>
                        `).join('')}
                      </select>
                    </div>

                    <div class="mb-3">
                      <label class="form-label">Montant reçu</label>
                      <input type="number" class="form-control montant-paiement-input"
                             step="0.01" min="0.01"
                             placeholder="Ex: ${this.total.toFixed(2)}"
                             value="${s.montantPaiement || this.total}">
                    </div>

                    ${s.montantPaiement > this.total ? `
                      <div class="alert alert-info">
                        <i class="bi bi-cash me-2"></i>
                        Rendu monnaie: <strong>${(s.montantPaiement - this.total).toFixed(2)} €</strong>
                      </div>
                    ` : ''}
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary close-paiement-modal">Annuler</button>
                    <button type="button" class="btn btn-success valider-vente-btn" ${!s.modePaiementId ? 'disabled' : ''}>
                      <i class="bi bi-check-circle me-1"></i>Valider la vente
                    </button>
                  </div>
                </div>
              </div>
            </div>`;
        }

        // === MODAL AVOIR ===
        if (s.showAvoirModal) {
          const totalProduits = this.roundToCent(
            s.lignes
              .filter(l => !l.is_avoir)
              .reduce((sum, l) => sum + this.calculateLineTotal(l.quantite, l.prix_unitaire), 0)
          );

          html += `
            <div class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
              <div class="modal-dialog">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title"><i class="bi bi-receipt me-2"></i>Ajouter un avoir</h5>
                    <button type="button" class="btn-close close-avoir-modal"></button>
                  </div>
                  <div class="modal-body">
                    <div class="alert alert-info">
                      <i class="bi bi-info-circle me-2"></i>
                      Total panier: <strong>${totalProduits.toFixed(2)} €</strong>
                    </div>

                    <div class="mb-3">
                      <label class="form-label">Montant de l'avoir *</label>
                      <input type="number" class="form-control avoir-montant-input"
                             step="0.01" min="0.01" max="${totalProduits}"
                             placeholder="Ex: 5.00" value="${s.avoirMontant || ''}">
                    </div>

                    <div class="mb-3">
                      <label class="form-label">Commentaire</label>
                      <input type="text" class="form-control avoir-commentaire-input"
                             placeholder="Ex: Produit défectueux" value="${s.avoirCommentaire || ''}">
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary close-avoir-modal">Annuler</button>
                    <button type="button" class="btn btn-warning valider-avoir-btn">
                      <i class="bi bi-check me-1"></i>Ajouter l'avoir
                    </button>
                  </div>
                </div>
              </div>
            </div>`;
        }

        // === MODAL CONFIRMATION CHARGER COMMANDE ===
        if (s.showModalChargerCommande) {
          html += `
            <div class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
              <div class="modal-dialog">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title"><i class="bi bi-exclamation-triangle me-2"></i>Confirmer le chargement</h5>
                    <button type="button" class="btn-close annuler-charger-commande-btn"></button>
                  </div>
                  <div class="modal-body">
                    <p>Le panier actuel contient déjà des articles.</p>
                    <p><strong>Voulez-vous le remplacer par la commande catalogue ?</strong></p>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary annuler-charger-commande-btn">
                      Annuler
                    </button>
                    <button type="button" class="btn btn-primary confirmer-charger-commande-btn">
                      Remplacer le panier
                    </button>
                  </div>
                </div>
              </div>
            </div>`;
        }

        container.innerHTML = html;

        // Restaurer le focus et position curseur
        if (isSearchFocused) {
          const searchInput = document.querySelector('.search-input');
          if (searchInput) {
            searchInput.focus();
            searchInput.setSelectionRange(cursorPosition, cursorPosition);
          }
        }

        this.attachEventListeners();
      },

      attachEventListeners() {
        // Recherche
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            this.state.searchQuery = e.target.value;
            this.updateDOM();
          });
        }

        // Utilisateur (select)
        const utilisateurSelect = document.querySelector('.utilisateur-select');
        if (utilisateurSelect) {
          utilisateurSelect.addEventListener('change', (e) => {
            this.state.selectedUtilisateur = e.target.value ? parseInt(e.target.value) : null;
            this.updateDOM();
          });
        }

        // Catégories (badges cliquables)
        document.querySelectorAll('.categorie-badge').forEach(badge => {
          badge.addEventListener('click', () => {
            const catId = parseInt(badge.dataset.categoryId);
            // Toggle : si déjà sélectionnée, on désélectionne
            this.state.selectedCategorie = this.state.selectedCategorie === catId ? null : catId;
            this.updateDOM();
          });
        });

        // Ajouter produit (click carte)
        document.querySelectorAll('.produit-card').forEach(card => {
          card.addEventListener('click', () => {
            const produitId = parseInt(card.dataset.produitId);
            const produit = this.state.produits.find(p => p.id === produitId);
            if (produit) {
              this.ajouterProduit(produit);
              this.updateDOM();
            }
          });
        });

        // Incrémenter quantité
        document.querySelectorAll('.increment-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            const ligne = this.state.lignes[index];
            if (ligne) {
              const quantiteMin = parseFloat(ligne.quantite_min) || 1;
              const newQty = parseFloat(ligne.quantite) + quantiteMin;
              this.modifierQuantite(index, newQty);
              this.updateDOM();
            }
          });
        });

        // Décrémenter quantité
        document.querySelectorAll('.decrement-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            const ligne = this.state.lignes[index];
            if (ligne) {
              const quantiteMin = parseFloat(ligne.quantite_min) || 1;
              const newQty = Math.max(quantiteMin, parseFloat(ligne.quantite) - quantiteMin);
              this.modifierQuantite(index, newQty);
              this.updateDOM();
            }
          });
        });

        // Modifier quantité (input) - validation avec quantite_min
        document.querySelectorAll('.quantite-input').forEach(input => {
          input.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            const ligne = this.state.lignes[index];
            if (ligne) {
              const quantiteMin = parseFloat(ligne.quantite_min) || 1;
              let nouvelleQuantite = parseFloat(e.target.value);

              // Validation : arrondir au multiple de quantite_min le plus proche
              const multiple = Math.round(nouvelleQuantite / quantiteMin);
              nouvelleQuantite = Math.max(1, multiple) * quantiteMin;

              this.modifierQuantite(index, nouvelleQuantite);
              this.updateDOM();
            }
          });
        });

        // Valider vente (ouvrir modal)
        const validerBtn = document.querySelector('.valider-btn');
        console.log('🟣 Bouton valider (ouvrir modal) trouvé:', validerBtn);
        if (validerBtn) {
          validerBtn.addEventListener('click', async () => {
            console.log('🟠 Click sur bouton valider (ouvrir modal)');
            await this.ouvrirPaiement();
            this.updateDOM();
          });
        }

        // Vider panier
        const viderBtn = document.querySelector('.vider-btn');
        if (viderBtn) {
          viderBtn.addEventListener('click', () => {
            if (confirm('Vider le panier ?')) {
              this.viderPanier();
              this.updateDOM();
            }
          });
        }

        // === NOUVEAUX EVENT LISTENERS PANIERS ===

        // Nouveau panier
        const nouveauPanierBtn = document.querySelector('.nouveau-panier-btn');
        if (nouveauPanierBtn) {
          nouveauPanierBtn.addEventListener('click', () => {
            this.nouveauPanier();
            this.updateDOM();
          });
        }

        // Sauvegarder panier
        const sauvegarderPanierBtn = document.querySelector('.sauvegarder-panier-btn');
        if (sauvegarderPanierBtn) {
          sauvegarderPanierBtn.addEventListener('click', async () => {
            await this.sauvegarderPanier();
            this.updateDOM();
          });
        }

        // Charger panier (ouvrir modal)
        const chargerPanierBtn = document.querySelector('.charger-panier-btn');
        if (chargerPanierBtn) {
          chargerPanierBtn.addEventListener('click', () => {
            this.state.showPaniersModal = true;
            this.updateDOM();
          });
        }

        // Fermer modal paniers
        document.querySelectorAll('.close-paniers-modal').forEach(btn => {
          btn.addEventListener('click', () => {
            this.state.showPaniersModal = false;
            this.updateDOM();
          });
        });

        // Charger un panier spécifique
        document.querySelectorAll('.charger-panier-id-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const panierId = parseInt(btn.dataset.panierId);
            await this.chargerPanier(panierId);
            this.updateDOM();
          });
        });

        // Supprimer un panier
        document.querySelectorAll('.supprimer-panier-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const panierId = parseInt(btn.dataset.panierId);
            await this.supprimerPanier(panierId);
            this.updateDOM();
          });
        });

        // === EVENT LISTENERS PAIEMENT ===

        // Fermer modal paiement
        document.querySelectorAll('.close-paiement-modal').forEach(btn => {
          btn.addEventListener('click', () => {
            this.state.showPaiementModal = false;
            this.state.modePaiementId = null;
            this.updateDOM();
          });
        });

        // Sélection mode de paiement
        const modePaiementSelect = document.querySelector('.mode-paiement-select');
        if (modePaiementSelect) {
          modePaiementSelect.addEventListener('change', (e) => {
            this.state.modePaiementId = e.target.value ? parseInt(e.target.value) : null;
            this.updateDOM();
          });
        }

        // Montant paiement
        const montantPaiementInput = document.querySelector('.montant-paiement-input');
        if (montantPaiementInput) {
          montantPaiementInput.addEventListener('input', (e) => {
            this.state.montantPaiement = parseFloat(e.target.value) || this.total;
            this.updateDOM();
          });
        }

        // Valider vente
        const validerVenteBtn = document.querySelector('.valider-vente-btn');
        console.log('🔴 Bouton valider vente trouvé:', validerVenteBtn);
        if (validerVenteBtn) {
          validerVenteBtn.addEventListener('click', async () => {
            console.log('🟡 Click sur bouton valider vente');
            await this.validerVente();
            this.updateDOM();
          });
        }

        // === NOUVEAUX EVENT LISTENERS AVOIRS ===

        // Ajouter avoir (ouvrir modal)
        const ajouterAvoirBtn = document.querySelector('.ajouter-avoir-btn');
        if (ajouterAvoirBtn) {
          ajouterAvoirBtn.addEventListener('click', () => {
            this.state.showAvoirModal = true;
            this.updateDOM();
          });
        }

        // Fermer modal avoir
        document.querySelectorAll('.close-avoir-modal').forEach(btn => {
          btn.addEventListener('click', () => {
            this.state.showAvoirModal = false;
            this.state.avoirMontant = 0;
            this.state.avoirCommentaire = '';
            this.updateDOM();
          });
        });

        // Input montant avoir
        const avoirMontantInput = document.querySelector('.avoir-montant-input');
        if (avoirMontantInput) {
          avoirMontantInput.addEventListener('input', (e) => {
            this.state.avoirMontant = e.target.value;
          });
        }

        // Input commentaire avoir
        const avoirCommentaireInput = document.querySelector('.avoir-commentaire-input');
        if (avoirCommentaireInput) {
          avoirCommentaireInput.addEventListener('input', (e) => {
            this.state.avoirCommentaire = e.target.value;
          });
        }

        // Valider avoir
        const validerAvoirBtn = document.querySelector('.valider-avoir-btn');
        if (validerAvoirBtn) {
          validerAvoirBtn.addEventListener('click', async () => {
            await this.ajouterAvoir();
            this.updateDOM();
          });
        }

        // Retirer ligne (inclut avoirs)
        document.querySelectorAll('.retirer-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            this.supprimerLigne(index);
            this.updateDOM();
          });
        });

        // === NOUVEAUX EVENT LISTENERS COMMANDES CATALOGUE ===

        // Actualiser commandes
        const actualiserCommandesBtn = document.querySelector('.actualiser-commandes-btn');
        if (actualiserCommandesBtn) {
          actualiserCommandesBtn.addEventListener('click', async () => {
            await this.chargerCommandesUtilisateur();
            this.updateDOM();
          });
        }

        // Sélectionner une commande
        const commandeSelect = document.querySelector('.commande-select');
        if (commandeSelect) {
          commandeSelect.addEventListener('change', (e) => {
            const commandeId = e.target.value ? parseInt(e.target.value) : null;
            if (commandeId) {
              const commande = this.state.commandesUtilisateur.find(c => c.id === commandeId);
              if (commande) {
                this.confirmerChargerCommande(commande);
              }
            }
          });
        }

        // Annuler chargement commande
        document.querySelectorAll('.annuler-charger-commande-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            this.annulerChargerCommande();
            this.updateDOM();
          });
        });

        // Confirmer chargement commande
        const confirmerChargerCommandeBtn = document.querySelector('.confirmer-charger-commande-btn');
        if (confirmerChargerCommandeBtn) {
          confirmerChargerCommandeBtn.addEventListener('click', async () => {
            if (this.state.commandeACharger) {
              await this.chargerCommandeDansPanier(this.state.commandeACharger.id);
              this.updateDOM();
            }
          });
        }
      }
    },

    mounted() {
      this.updateDOM();

      // Watchers pour mise à jour DOM
      this.$watch(() => this.state.produits, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.state.lignes, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.state.showPaniersModal, () => this.updateDOM());
      this.$watch(() => this.state.showAvoirModal, () => this.updateDOM());
      this.$watch(() => this.state.showModalChargerCommande, () => this.updateDOM());
      this.$watch(() => this.state.commandesUtilisateur, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.state.savedPaniers, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.state.modesPaiement, () => this.updateDOM(), { deep: true });

      // Réinitialiser catégorie sélectionnée si elle n'est plus dans les catégories filtrées
      this.$watch(() => this.categoriesFiltrées, (newCategories) => {
        if (this.state.selectedCategorie) {
          const categorieExiste = newCategories.some(c => c.id === this.state.selectedCategorie);
          if (!categorieExiste) {
            this.state.selectedCategorie = null;
          }
        }
      }, { deep: true });
    },

    render() {
      return Vue.h('div', {
        ref: 'container',
        id: 'caisse-container'
      });
    }
  });

  app.mount('#caisse-app');
  console.log('✅ CaisseApp monté avec succès !');
})();
