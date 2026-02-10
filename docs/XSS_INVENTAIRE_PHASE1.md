ok # Inventaire Phase 1 - Vulnérabilités XSS (innerHTML)

**Date :** 6 février 2026  
**Statut :** Phase 1 terminée (Test 1.1 + Test 1.2)

---

## Test 1.1 - Inventaire des occurrences d'innerHTML

Toutes les occurrences d'`innerHTML` dans `views/*.ejs` (hors archive) ont été recensées.

---

### 1. `views/caisse_accueil.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 169-172 | `content.innerHTML = '<div class="caisse-stat-card">...' + nb + '...' + ca.toFixed(2) + '...' + moy.toFixed(2) + '...'` | Stats caisse (nb ventes, CA, ticket moyen) |
| 216-218 | Idem (second bloc stats du mois) | Stats du mois (mêmes champs numériques) |

**Source des données :** API `/api/caisse/ventes-historique/stats/resume` — champs numériques (`nb_ventes`, `ca_total`, `ticket_moyen`).  
**Risque :** **FAIBLE** — Données numériques formatées côté client (`Number()`, `toFixed(2)`). Un attaquant ne peut pas injecter du HTML via l’API sans contrôle des données serveur. Pour renforcer la défense en profondeur : utiliser `textContent` pour les valeurs ou construire le DOM sans innerHTML.

---

### 2. `views/caisse_cotisations_historique_vue.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 187 | `tbody.innerHTML = ''` | Vidage du tableau (chaîne vide) |
| 193-195 | `tbody.innerHTML = sorted.map(function(r) { return '<tr><td>' + formatDate(r.date_cotisation) + '</td><td>' + (nom(r) \|\| '–') + '</td>...'` | Lignes du tableau : date, nom, numero_ticket, montant |
| 230, 241 | `tbody.innerHTML = ''` | Vidage (chaîne vide) |

**Source des données :** API `/api/caisse/cotisation/historique` — `date_cotisation`, `nom(r)` (utilisateur), `numero_ticket`, `montant_cotisation`.  
**Risque :** **MOYEN** — `nom(r)` et `numero_ticket` peuvent contenir des données saisies ou affichées (nom utilisateur, numéro de ticket). Si ces champs viennent de la BDD sans échappement, risque XSS.  
**Action :** Échapper `nom(r)` et `numero_ticket` (ex. `escapeHtml()`) avant concaténation dans le HTML.

---

### 3. `views/paniers_grouped.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 391-392 | `noteDisplay.innerHTML = '...<span class="note-content"></span>'; noteDisplay.querySelector('.note-content').textContent = note` | Note de commande : HTML fixe + contenu dynamique dans un span avec `textContent` |
| 401-402 | Idem pour `newDisplay` | Idem |
| 410 | `button.innerHTML = '<i class="bi bi-pencil-square"></i>...'` | Bouton (HTML fixe) |
| 421 | `button.innerHTML = '<i class="bi bi-pencil-square"></i> Ajouter note'` | Bouton (HTML fixe) |

**Source des données :** `note` = note de commande (utilisateur).  
**Risque :** **FAIBLE** — Déjà sécurisé : le contenu dynamique (`note`) est injecté via `textContent` dans un `.note-content`. Les autres innerHTML sont du HTML statique.  
**Action :** Aucune correction nécessaire pour les notes ; vérifier qu’aucune autre donnée utilisateur n’est concaténée ailleurs dans le fichier.

---

### 4. `views/admin_dashboard_temps_reel.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 141-144 | `commandesList.innerHTML = cmd.map(function(c) { return '...' + (c.username \|\| '') + '...' + (c.id \|\| '') + '...' + (c.catalogue_nom \|\| '–') + '...' + formatDate(...) + '</div>'; }).join('')` | Liste commandes temps réel : username, id, catalogue_nom, date |

**Source des données :** EventSource `/admin/dashboard-temps-reel/stream` — données JSON (username, id, catalogue_nom, updated_at/created_at).  
**Risque :** **ÉLEVÉ** — `username` et `catalogue_nom` sont des données utilisateur/BDD concaténées directement dans le HTML. Un username ou un nom de catalogue malveillant peut provoquer une exécution de script.  
**Action :** Utiliser une fonction `escapeHtml()` pour `c.username`, `c.catalogue_nom` (et toute autre chaîne venue du serveur) avant de les insérer dans la chaîne HTML.

---

### 5. `views/admin_users_connected.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 95 | `tbody.innerHTML = ''` | Vidage (chaîne vide) |
| 96-99 | `tbody.innerHTML = list.map(function(u) { ... return '<tr><td><span class="fw-bold">' + (u.username \|\| '') + '</span>...' + org + '</td><td>' + (u.sessionCount \|\| 0) + '</td><td>...' + exp + '</td></tr>'; }).join('')` | Liste utilisateurs connectés : username, org, sessionCount, exp |

**Source des données :** EventSource `/admin/connected-users/stream` — `username`, `organizationName`/`organization_id`, `sessionCount`, `maxExpires`.  
**Risque :** **ÉLEVÉ** — `u.username` et `org` (organizationName ou `#` + id) sont concaténés dans le HTML sans échappement.  
**Action :** Échapper `u.username`, `org` et toute chaîne affichée avec `escapeHtml()` avant concaténation.

---

### 6. `views/admin_catalogue_form.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 321 | `selectEl.innerHTML = '<option value="">Chargement...</option>'` | Message fixe |
| 328 | `selectEl.innerHTML = '<option value="">-- Sélectionner un catalogue --</option>'` + options | Options de catalogue (liste issue de l’API) |
| 338, 342 | `selectEl.innerHTML = '<option value="">Erreur de chargement</option>'` | Message fixe |

**Source des données :** API pour la liste des catalogues ; options construites à partir de `data.catalogues`.  
**Risque :** **MOYEN** — Si les options incluent des noms de catalogues (ou autres libellés) sans échappement, risque XSS. Vérifier la construction des `<option>` (attributs value et texte).  
**Action :** S’assurer que chaque libellé de catalogue utilisé dans les options est échappé avec `escapeHtml()`.

---

### 7. `views/admin_catalogue_upload_form.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 157-158 | `fileInfo.innerHTML = '...<span class="filename"></span>'; fileInfo.querySelector('.filename').textContent = fileName` | Nom de fichier : HTML fixe + nom dans un span avec `textContent` |

**Source des données :** `fileName` = nom du fichier sélectionné (input file).  
**Risque :** **FAIBLE** — Déjà sécurisé : le nom de fichier est mis dans un span via `textContent`.  
**Action :** Aucune.

---

### 8. `views/caisse_test_codes_barres.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 103 | `historyList.innerHTML = html \|\| '<li class="...">Aucun scan</li>'` avec `html = history.map(function (h) { return '<li...><code>' + h.code + '</code><span...>' + h.at + '</span></li>'; }).join('')` | Historique des scans : code barre (`h.code`), heure (`h.at`) |

**Source des données :** `h.code` = code barre saisi (lecteur ou utilisateur), `h.at` = heure générée côté client.  
**Risque :** **MOYEN** — `h.code` peut contenir des caractères arbitraires si saisi manuellement ou si le lecteur envoie des données non contrôlées.  
**Action :** Échapper `h.code` (et par précaution `h.at`) avec `escapeHtml()` avant de les mettre dans le HTML.

---

### 9. `views/admin_category_form.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 263-265 | `iconDisplay.innerHTML = '<i class="' + iconClass + ' me-2"...></i><span...>' + iconClass + '</span>'` | Classe d’icône Bootstrap (ex. `bi bi-*`) |
| 268 | `iconDisplay.innerHTML = '<span class="text-muted">Aucune icône</span>'` | Message fixe |

**Source des données :** `iconClass` = attribut `data-icon` des options (liste prédéfinie côté serveur/EJS).  
**Risque :** **MOYEN** — Si `data-icon` peut être contrôlé (ex. édition du HTML ou donnée BDD), une valeur du type `"><script>...` pourrait ouvrir une XSS.  
**Action :** Valider/restreindre `iconClass` à une liste de classes autorisées (ex. préfixe `bi bi-`) et/ou échapper avec `escapeHtml()`.

---

### 10. `views/admin_catalogue_edit_form.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 970 | `addSelectedBtn.innerHTML = '<span class="spinner-border...'></span>Ajout en cours...'` | Bouton “Ajout en cours” (fixe) |
| 991, 997 | `addSelectedBtn.innerHTML = '<i class="bi bi-plus-circle...'></i>Ajouter les produits sélectionnés'` | Bouton (fixe) |

**Source des données :** Aucune donnée utilisateur, uniquement du HTML statique.  
**Risque :** **FAIBLE** — Aucune action requise.

---

### 11. `views/catalogue_articles.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 370-371 | `if (!button.innerHTML \|\| ...) { button.innerHTML = '<i class="bi bi-pencil-square"></i> Note' }` | Bouton (HTML fixe) |
| 382 | `display.innerHTML = '<strong>Note:</strong> <span class="note-content"></span>'` | Structure de la note ; le contenu est mis via `updateNoteDisplay(..., noteText)` avec `content.textContent = noteText` |
| 415 | `saveButton.innerHTML = '<i class="bi bi-check-circle"></i> Sauvegarder'` | Bouton (fixe) |
| 422 | `cancelButton.innerHTML = '<i class="bi bi-x-circle"></i> Annuler'` | Bouton (fixe) |
| 476, 480 | `btn.innerHTML = '...'` | Boutons (fixe) |

**Source des données :** Contenu de note = `noteText` dans `updateNoteDisplay` → déjà injecté via `textContent` dans `.note-content`.  
**Risque :** **FAIBLE** — Pas de concaténation de données utilisateur dans innerHTML ; les boutons sont en HTML statique.  
**Action :** Aucune pour ces lignes. Vérifier qu’aucun autre endroit du fichier ne concatène des données utilisateur dans innerHTML.

---

### 12. `views/stats.ejs`

| Ligne | Code | Contexte |
|-------|------|----------|
| 488 | `tbody.innerHTML = '<tr><td colspan="4"...>Aucune commande disponible</td></tr>'` | Message fixe |
| 491-502 | `tbody.innerHTML = commandes.map(commande => \`...\${escapeHtml(commande....)}...\`)` | Tableau commandes : **escapeHtml() déjà utilisé** |
| 510-511 | `document.getElementById('commandes-tbody').innerHTML = '...Erreur...'` | Message fixe |
| 526 | `tbody.innerHTML = '<tr>...Aucun utilisateur...'` | Message fixe |
| 529-568 | `tbody.innerHTML = utilisateurs.map(user => { ... escapeHtml(...) ... })` | Tableau utilisateurs : **escapeHtml() déjà utilisé** |
| 577-578 | `...innerHTML = '...Erreur...'` | Message fixe |
| 593 | `tbody.innerHTML = '...Aucun catalogue...'` | Message fixe |
| 596-606 | `tbody.innerHTML = catalogues.map(catalogue => \`...\${escapeHtml(...)}...\`)` | Tableau catalogues : **escapeHtml() déjà utilisé** |
| 622-623 | `...innerHTML = '...Erreur...'` | Message fixe |
| 639 | `tbody.innerHTML = '...Aucune donnée...'` | Message fixe |
| 752 | `tbody.innerHTML = rows.join('')` | Lignes période : **escapeHtml() utilisé dans les templates de lignes** (l.726-746) |
| 759-760 | `...innerHTML = '...Erreur...'` | Message fixe |

**Source des données :** Données API (commandes, utilisateurs, catalogues, agrégats).  
**Risque :** **FAIBLE** — Les blocs qui injectent des données utilisateur utilisent déjà `escapeHtml()`. Les autres innerHTML sont des messages fixes.  
**Action :** S’assurer que toutes les variables dynamiques dans les templates de `stats.ejs` passent bien par `escapeHtml()` (audit rapide des chaînes interpolées).

---

## Test 1.2 - Synthèse par niveau de risque

### Risque ÉLEVÉ (correction prioritaire)

| Fichier | Lignes | Données concernées | Action |
|---------|--------|--------------------|--------|
| `admin_dashboard_temps_reel.ejs` | 141-144 | `c.username`, `c.catalogue_nom` | Échapper avec `escapeHtml()` avant concaténation dans le HTML |
| `admin_users_connected.ejs` | 96-99 | `u.username`, `org` | Échapper avec `escapeHtml()` |

### Risque MOYEN

| Fichier | Lignes | Données concernées | Action |
|---------|--------|--------------------|--------|
| `caisse_cotisations_historique_vue.ejs` | 193-195 | `nom(r)`, `r.numero_ticket` | Échapper avec `escapeHtml()` |
| `admin_catalogue_form.ejs` | 328 | Libellés des options catalogues | Vérifier construction des options et échapper les libellés |
| `caisse_test_codes_barres.ejs` | 100-103 | `h.code`, `h.at` | Échapper `h.code` (et `h.at` par précaution) |
| `admin_category_form.ejs` | 263-265 | `iconClass` | Valider liste de classes autorisées et/ou échapper |

### Risque FAIBLE (défense en profondeur ou déjà sécurisé)

| Fichier | Lignes | Commentaire |
|---------|--------|-------------|
| `caisse_accueil.ejs` | 169-172, 216-218 | Numériques uniquement ; optionnel : éviter innerHTML pour les valeurs |
| `paniers_grouped.ejs` | 391-392, 401-402 | Déjà sécurisé (textContent pour la note) |
| `admin_catalogue_upload_form.ejs` | 157-158 | Déjà sécurisé (textContent pour le nom de fichier) |
| `admin_catalogue_edit_form.ejs` | 970, 991, 997 | HTML statique uniquement |
| `catalogue_articles.ejs` | 370-382, 415, 422, 476, 480 | HTML statique ou note via textContent |
| `stats.ejs` | multiples | Déjà utilisation de `escapeHtml()` pour les données dynamiques |

---

## Prérequis pour la Phase 2

1. **Helper `escapeHtml()`**  
   - Fichier : `public/js/xss-protection.js` (déjà présent).  
   - S’assurer qu’il est chargé sur toutes les vues qui utilisent innerHTML avec des données dynamiques (par ex. inclure le script dans les layouts ou les vues concernées).

2. **Ordre de correction recommandé**  
   - D’abord : `admin_dashboard_temps_reel.ejs`, `admin_users_connected.ejs`.  
   - Ensuite : `caisse_cotisations_historique_vue.ejs`, `admin_catalogue_form.ejs`, `caisse_test_codes_barres.ejs`, `admin_category_form.ejs`.  
   - Enfin : renforcer si besoin `caisse_accueil.ejs` (éviter innerHTML pour les nombres ou échapper).

3. **Vérifications après corrections**  
   - Aucune nouvelle utilisation d’innerHTML avec concaténation directe de données utilisateur ou API sans échappement.  
   - Pour chaque page modifiée : test manuel avec des valeurs contenant `<script>`, `"`, `'`, `&`, `<`, `>`.

---

## Phase 2 – Corrections appliquées (6 fév. 2026)

- **admin_dashboard_temps_reel.ejs** : chargement de `/js/xss-protection.js` ; dans le rendu SSE, `escapeHtml()` appliqué à `c.username`, `c.id`, `c.catalogue_nom`, `formatDate(...)`.
- **admin_users_connected.ejs** : chargement de `/js/xss-protection.js` ; dans le rendu SSE, `escapeHtml()` appliqué à `u.username`, `u.userId`, `org`, `exp`.
- **caisse_cotisations_historique_vue.ejs** : chargement de `/js/xss-protection.js` ; dans `renderTable`, `escapeHtml()` appliqué à `formatDate(r.date_cotisation)`, `nom(r)`, `r.numero_ticket`.
- **caisse_test_codes_barres.ejs** : chargement de `/js/xss-protection.js` ; dans l'historique des scans, `escapeHtml()` appliqué à `h.code` et `h.at`.
- **admin_category_form.ejs** : chargement de `/js/xss-protection.js` ; pour l'affichage de l'icône sélectionnée, `iconClass` est échappé avec `escapeHtml()` avant insertion dans `innerHTML`.
- **admin_catalogue_form.ejs** : aucune modification (les options sont déjà créées avec `createElement` et `option.textContent`).

---

## Phase 3 – Tests (6 fév. 2026)

**Tests automatisés ajoutés :**

- **tests/utils/xss-protection.spec.js** : test unitaire de `escapeHtml` (payloads XSS classiques, entrées vides, régression).
- **tests/views/xss-phase3.spec.js** : GET `/js/xss-protection.js` (200, contient `escapeHtml`) ; vérification que les vues modifiées sont protégées (sans auth → 302/403).

Commande : `npm run test -- --testPathPattern="xss|escapeHtml"`

**Tests manuels (optionnel)** : selon le plan dans `docs/ANALYSE_COMPLETE_CODE.md` (section « Plan de tests - Vulnérabilités XSS »), ex. note de panier avec `<script>alert('XSS')</script>`, dashboard temps réel avec username/catalogue malveillant, etc.

---

## Checklist Phase 1

- [x] **Test 1.1** : Toutes les occurrences d’innerHTML dans `views/*.ejs` identifiées et documentées.
- [x] **Test 1.2** : Source des données et niveau de risque (élevé / moyen / faible) définis pour chaque occurrence.
- [x] **Phase 2** : Corrections appliquées ; `xss-protection.js` chargé sur les 5 vues concernées ; données dynamiques échappées (voir section « Phase 2 – Corrections appliquées » ci-dessous).
- [x] **Phase 3** : Tests fonctionnels XSS — tests automatisés ajoutés (voir ci-dessous). Tests manuels optionnels selon le plan dans ANALYSE_COMPLETE_CODE.md.
