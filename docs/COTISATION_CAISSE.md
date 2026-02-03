# Cotisation mensuelle (5-15 €) en caisse

Une fois par mois, lors d’un passage en caisse, l’utilisateur identifié doit s’acquitter d’une cotisation entre 5 et 15 € au choix. Le système vérifie à chaque passage que la cotisation du mois courant est bien prise en compte.

---

## 1. Migration SQL

**Fichier :** `migrations/add_cotisation_caisse.sql`

- Ajout de la colonne **`is_cotisation`** (BOOLEAN, défaut FALSE) dans la table **`lignes_vente`**, pour marquer les lignes « Cotisation mensuelle ».

**À exécuter une seule fois :**

```bash
mysql -u VOTRE_USER -p VOTRE_BDD < migrations/add_cotisation_caisse.sql
```

Ou via votre client SQL (phpMyAdmin, DBeaver, etc.) en exécutant le contenu du fichier.

---

## 2. Backend

### Route GET `/api/caisse/cotisation/check?adherent_id=`

- **Fichier :** `routes/api.caisse.cotisation.routes.js`
- **Permission :** `caisse.sell`
- **Réponse :** `{ success, doit_cotiser, mois_courant, message }`
- **Logique :** Si `adherent_id` est vide → `doit_cotiser: false`. Sinon, recherche une vente du mois courant pour cet adhérent contenant une ligne cotisation (is_cotisation = 1 ou produit_id NULL + nom "Cotisation mensuelle"). Si trouvée → `doit_cotiser: false`, sinon → `doit_cotiser: true`.

### Route GET `/api/caisse/cotisation/historique`

- **Fichier :** `routes/api.caisse.cotisation.routes.js`
- **Permission :** `caisse.sell`
- **Query (optionnel) :** `adherent_id` (ID utilisateur), `date_debut` (YYYY-MM-DD), `date_fin` (YYYY-MM-DD), `limit` (défaut 200, max 500)
- **Réponse :** `{ success, cotisations: [{ vente_id, numero_ticket, adherent_id, nom_client, date_cotisation, montant_cotisation }], total }`
- **Exemple :** `GET /api/caisse/cotisation/historique?adherent_id=1` pour l’historique des cotisations d’une personne ; `?date_debut=2026-01-01&date_fin=2026-12-31` pour une période.

### Route POST `/api/caisse/ventes` (modifications)

- **Fichier :** `routes/api.caisse.ventes.routes.js`
- Les lignes peuvent contenir **`is_cotisation: true`** (produit_id null, nom_produit "Cotisation mensuelle", quantite 1, prix_unitaire entre 5 et 15).
- L’INSERT dans **lignes_vente** enregistre la colonne **is_cotisation** (0 ou 1).
- **Pas de décrémentation de stock** pour les lignes sans produit_id ou avec is_cotisation.
- **Validation cotisation :** Avant de créer la vente, si un `adherent_id` est fourni, le serveur vérifie si l’adhérent doit cotiser ce mois. Si oui et qu’aucune ligne du panier n’a `is_cotisation: true`, la requête renvoie **400** avec le message : *« Cotisation mensuelle requise (5-15 €). Veuillez ajouter la cotisation au panier. »*

### Historique / détail vente

- **Fichier :** `routes/api.caisse.ventes-historique.routes.js`
- Les lignes renvoyées (détail vente, PDF) incluent **`is_cotisation`** (booléen dérivé de la colonne) pour l’affichage et le ticket PDF.

### Montage de la route

- **Fichier :** `app.js`
- `app.use("/api/caisse/cotisation", apiCaisseCotisationRoutes);`

---

## 3. Frontend (caisse)

### API

- **Fichier :** `frontend/src/api/index.js`
- **Fonction :** `fetchCaisseCotisationCheck(adherentId)` → GET `/api/caisse/cotisation/check?adherent_id=...`

### Store Pinia (caisse)

- **Fichier :** `frontend/src/stores/caisse.js`
- **State :** `cotisationCheck: null` (résultat de l’appel check).
- **Getter :** `aPanierCotisation` → true si au moins une ligne du panier a `is_cotisation: true`.
- **Actions :**
  - **ouvrirPaiement()** : devient async ; à l’ouverture de la modale, si un utilisateur est sélectionné, appelle `fetchCaisseCotisationCheck(selectedUtilisateur)` et stocke le résultat dans `cotisationCheck`.
  - **checkCotisation()** : recharge le statut cotisation pour l’utilisateur courant.
  - **ajouterCotisation(montant)** : ajoute une ligne au panier avec `produit_id: null`, `nom_produit: "Cotisation mensuelle"`, `quantite: 1`, `prix_unitaire: montant` (entre 5 et 15), `is_avoir: false`, `is_cotisation: true`. Met à jour `montantPaiement` avec le nouveau total.

### Page Caisse (Vue)

- **Fichier :** `frontend/src/views/CaissePage.vue`
- **Modale « Valider la vente » :** Si `store.cotisationCheck?.doit_cotiser` et `!store.aPanierCotisation`, affichage d’un bloc d’alerte avec le texte « Cotisation mensuelle » et trois boutons : **5 €**, **10 €**, **15 €**. Un clic appelle `store.ajouterCotisation(5)` (ou 10 / 15). Le total à payer se met à jour et le bloc disparaît dès qu’une ligne cotisation est présente.
- **Panier (liste des lignes) :** Les lignes avec `is_cotisation` sont affichées avec un style **info** (fond bleu clair, icône pièce, texte info) ; les avoirs restent en style warning.

---

## 4. Affichage ailleurs

### Historique caisse (détail vente)

- **Fichier :** `frontend/src/views/CaisseHistoriquePage.vue`
- Dans le détail d’une vente (modale), les lignes avec `is_cotisation` ont la classe `table-info`, un badge **« Cotisation »** (bg-info) et le montant en `text-info`. Les avoirs gardent le badge « AVOIR » et le style warning.

### Ticket PDF

- **Fichier :** `utils/ticket-pdf.js`
- Les lignes cotisation sont affichées avec le suffixe **« (Cotisation) »** et la couleur bleue (#0d6efd) pour le montant. Les avoirs restent en rouge avec « (AVOIR) ».

---

## 5. Comportement récapitulatif

| Cas | Comportement |
|-----|--------------|
| **Client anonyme** (aucun utilisateur sélectionné) | Aucune vérification cotisation. |
| **Utilisateur identifié, a déjà payé la cotisation ce mois** | `doit_cotiser: false`. Pas de bloc cotisation dans la modale. Vente possible sans ligne cotisation. |
| **Utilisateur identifié, n’a pas encore payé ce mois** | `doit_cotiser: true`. Dans la modale paiement, affichage du bloc « Cotisation mensuelle (5-15 €) » avec boutons 5 / 10 / 15 €. L’utilisateur doit en choisir un pour ajouter la ligne au panier. Sans cette ligne, le serveur refuse la vente (400). |
| **Ligne cotisation dans le panier** | Affichée comme « Cotisation mensuelle » en style info dans le panier et incluse dans le total. Enregistrée en base avec `is_cotisation = 1`. |

La vérification « ce mois » repose sur `YEAR(v.created_at)` et `MONTH(v.created_at)` des ventes, comparés au mois courant du serveur.
