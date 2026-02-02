# Migration RBAC - Routes

## Résumé de la migration

La migration des routes vers le système RBAC a été effectuée avec succès. Tous les anciens middlewares basés sur les rôles (`requireReferent`, `requireAdmin`, `requireSuperAdmin`, `requireUtilisateur`, `requireRole`) ont été remplacés par les nouveaux middlewares basés sur les permissions (`requirePermission`, `requireAnyPermission`).

## Fichiers migrés

### 1. routes/api.admin.categories.routes.js
- **Occurrences migrées:** 2
- **Middleware principal:** `requirePermission('categories.view', { json: true })`

### 2. routes/api.admin.products.routes.js
- **Occurrences migrées:** 4
- **Middleware principal:** `requirePermission('products.view', { json: true })`

### 3. routes/panier.routes.js
- **Occurrences migrées:** 16
- **Middlewares utilisés:**
  - `requirePermission('paniers.view_own')` - pour les utilisateurs normaux
  - `requirePermission('paniers.edit')` - pour la modification

### 4. routes/categories.routes.js
- **Occurrences migrées:** 8
- **Middlewares utilisés:**
  - `requirePermission('categories.view')` - consultation
  - `requirePermission('categories.create')` - création
  - `requirePermission('categories.edit')` - modification
  - `requirePermission('categories.delete')` - suppression

### 5. routes/products.routes.js
- **Occurrences migrées:** 10
- **Middlewares utilisés:**
  - `requirePermission('products.view')` - consultation
  - `requirePermission('products.create')` - création
  - `requirePermission('products.edit')` - modification
  - `requirePermission('products.delete')` - suppression

### 6. routes/admin.routes.js
- **Occurrences migrées:** 80
- **Middlewares utilisés:**
  - **Catalogues:**
    - `requirePermission('catalogues.view')`
    - `requirePermission('catalogues.create')`
    - `requirePermission('catalogues.edit')`
    - `requirePermission('catalogues.delete')`
  - **Users:**
    - `requirePermission('users.view')`
    - `requirePermission('users.create')`
    - `requirePermission('users.edit')`
  - **Paniers/Commandes (admin):**
    - `requirePermission('paniers.view_all')`
    - `requirePermission('commandes.view_all')`
  - **Organizations:**
    - `requirePermission('organizations.view')`
  - **Roles:**
    - `requirePermission('roles.view')`

## Mapping des permissions

### Catalogues
| Ancienne route | Ancien middleware | Nouvelle permission |
|----------------|-------------------|---------------------|
| GET /catalogues | `requireReferent` | `catalogues.view` |
| POST /catalogues/create-* | `requireReferent` | `catalogues.create` |
| POST /catalogues/:id/* | `requireReferent` | `catalogues.edit` |
| POST /catalogues/:id/delete | `requireReferent` | `catalogues.delete` |

### Produits
| Ancienne route | Ancien middleware | Nouvelle permission |
|----------------|-------------------|---------------------|
| GET /products | `requireReferent` | `products.view` |
| POST /products | `requireReferent` | `products.create` |
| POST /products/:id | `requireReferent` | `products.edit` |
| POST /products/:id/delete | `requireReferent` | `products.delete` |

### Catégories
| Ancienne route | Ancien middleware | Nouvelle permission |
|----------------|-------------------|---------------------|
| GET /categories | `requireReferent` | `categories.view` |
| POST /categories | `requireReferent` | `categories.create` |
| POST /categories/:id | `requireReferent` | `categories.edit` |
| POST /categories/:id/delete | `requireReferent` | `categories.delete` |

### Paniers
| Ancienne route | Ancien middleware | Nouvelle permission |
|----------------|-------------------|---------------------|
| GET /panier | `requireUtilisateur` | `paniers.view_own` |
| POST /panier/add | `requireRole([...])` | `paniers.edit` |
| POST /panier/:id/submit | `requireRole([...])` | `paniers.edit` |
| GET /admin/paniers/:id | `requireReferent` | `paniers.view_all` |

### Users
| Ancienne route | Ancien middleware | Nouvelle permission |
|----------------|-------------------|---------------------|
| GET /admin/users | `requireAdmin` | `users.view` |
| POST /admin/users/new | `requireAdmin` | `users.create` |
| POST /admin/users/:id/edit | `requireAdmin` | `users.edit` |

## Statistiques

- **Total de routes migrées:** 120+
- **Fichiers modifiés:** 6
- **Anciens middlewares supprimés:** 93
- **Nouveaux middlewares RBAC ajoutés:** 120

## Vérifications effectuées

✅ Syntaxe JavaScript valide pour tous les fichiers  
✅ Aucune occurrence des anciens middlewares restante  
✅ Tous les imports mis à jour vers `rbac.middleware`  
✅ Option `{ json: true }` ajoutée pour les routes API  

## Prochaines étapes

1. **Tester l'application** pour s'assurer que toutes les routes fonctionnent correctement
2. **Vérifier les logs** pour détecter d'éventuels problèmes de permissions
3. **Ajuster les permissions** des rôles si nécessaire dans la base de données
4. **Mettre à jour la documentation** utilisateur si besoin

## Notes importantes

- Les routes API ont l'option `{ json: true }` pour retourner des erreurs JSON au lieu de rediriger
- Les anciennes vérifications de rôle ont été remplacées par des vérifications de permission plus granulaires
- Le système RBAC permet maintenant une gestion plus fine des accès

## Fichiers de backup

Des fichiers de backup ont été créés automatiquement avec l'extension `.backup` lors de la migration de `admin.routes.js`.

---

**Date de migration:** 2026-01-29  
**Migration effectuée par:** Claude Sonnet 4.5
