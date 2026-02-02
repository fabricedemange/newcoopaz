# Checklist de Déploiement RBAC - Système Pur et Complet

## ✅ Phase 1: Infrastructure (TERMINÉ)

Tous les fichiers ont été créés avec succès:

### Base de données
- ✅ `/migrations/20260128_rbac_complete.sql` - Migration complète (6 tables, 78 permissions, procédures stockées)

### Backend
- ✅ `/middleware/rbac.middleware.js` - Middleware avec cache 2 niveaux
- ✅ `/routes/api.admin.roles.routes.js` - API gestion rôles
- ✅ `/routes/api.admin.permissions.routes.js` - API liste permissions
- ✅ `/routes/api.admin.user-roles.routes.js` - API assignation rôles

### Frontend
- ✅ `/public/vue/AdminRolesApp.js` - Interface gestion rôles
- ✅ `/public/vue/AdminUserRolesApp.js` - Interface assignation rôles
- ✅ `/views/admin_roles_vue.ejs` - Template gestion rôles
- ✅ `/views/admin_user_roles_vue.ejs` - Template assignation rôles

### Intégration
- ✅ `/app.js` - Routes RBAC enregistrées
- ✅ `/routes/admin.routes.js` - Routes pages Vue ajoutées
- ✅ `/docs/RBAC_IMPLEMENTATION.md` - Documentation complète

## 📋 Phase 2: Déploiement (À FAIRE)

### Étape 1: Backup base de données

```bash
# IMPORTANT: Faire un backup avant toute modification
mysqldump -u root -p coopaz > backup_pre_rbac_$(date +%Y%m%d_%H%M%S).sql
```

### Étape 2: Exécuter la migration

```bash
# Exécuter le script de migration
mysql -u root -p coopaz < migrations/20260128_rbac_complete.sql
```

**Vérifications attendues:**
```sql
-- 1. Vérifier 5 rôles système créés
SELECT COUNT(*) as nb_roles FROM roles WHERE is_system = 1;
-- Résultat attendu: 5

-- 2. Vérifier 78 permissions créées
SELECT COUNT(*) as nb_permissions FROM permissions;
-- Résultat attendu: 78

-- 3. Vérifier mappings rôle-permissions (environ 200)
SELECT COUNT(*) as nb_mappings FROM role_permissions;
-- Résultat attendu: ~200

-- 4. Vérifier que les tables sont bien créées
SHOW TABLES LIKE '%role%';
-- Doit montrer: roles, user_roles, role_permissions

SHOW TABLES LIKE '%permission%';
-- Doit montrer: permissions, permission_cache, permission_audit_log

-- 5. Vérifier les colonnes users modifiées
SHOW COLUMNS FROM users LIKE '%rbac%';
-- Doit montrer: rbac_enabled, legacy_role

-- 6. Vérifier les procédures stockées
SHOW PROCEDURE STATUS WHERE Name LIKE '%rbac%';
-- Doit montrer: migrate_user_to_rbac, migrate_all_users_to_rbac, check_user_has_permission
```

### Étape 3: Redémarrer l'application

```bash
# Avec npm
npm restart

# Ou avec PM2
pm2 restart coopaz

# Vérifier les logs
pm2 logs coopaz --lines 50
```

### Étape 4: Tests API (Sans UI)

```bash
# Test 1: Liste des rôles
curl -X GET http://localhost:3000/api/admin/roles \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "CSRF-Token: YOUR_CSRF_TOKEN"

# Test 2: Liste des permissions
curl -X GET http://localhost:3000/api/admin/permissions \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "CSRF-Token: YOUR_CSRF_TOKEN"
```

### Étape 5: Accéder aux interfaces

#### Page de gestion des rôles
```
URL: http://localhost:3000/admin/roles/vue
Requis: Rôle admin ou SuperAdmin
```

**Tests à effectuer:**
- [ ] La page se charge sans erreur
- [ ] 5 rôles système sont affichés (badge bleu "Système")
- [ ] Bouton "Nouveau rôle" est visible
- [ ] Cliquer sur "Nouveau rôle" ouvre la modal
- [ ] Les permissions sont groupées par module (accordéons)
- [ ] Peut créer un rôle custom test (ex: `test_role`)
- [ ] Le rôle créé apparaît dans la liste (badge vert "Custom")

#### Page d'assignation de rôles
```
URL: http://localhost:3000/admin/users/[USER_ID]/roles
Exemple: http://localhost:3000/admin/users/1/roles
Requis: Rôle admin ou SuperAdmin
```

**Tests à effectuer:**
- [ ] La page se charge sans erreur
- [ ] La liste des rôles disponibles s'affiche
- [ ] Peut assigner un rôle à l'utilisateur
- [ ] Le rôle assigné apparaît dans "Rôles Actuels"
- [ ] Les permissions effectives sont affichées (cumul des rôles)

## 📊 Phase 3: Migration des utilisateurs

### Option A: Migrer UN utilisateur test (Recommandé pour début)

```sql
-- 1. Choisir un utilisateur de test (ex: votre compte admin)
SELECT id, username, role FROM users WHERE username = 'votre_username';

-- 2. Migrer cet utilisateur
CALL migrate_user_to_rbac(1);  -- Remplacer 1 par l'ID de votre utilisateur

-- 3. Vérifier la migration
SELECT id, username, role, legacy_role, rbac_enabled FROM users WHERE id = 1;
-- rbac_enabled doit être = 1
-- legacy_role doit contenir l'ancien rôle

-- 4. Vérifier l'assignation du rôle
SELECT u.username, r.display_name, ur.assigned_at
FROM user_roles ur
INNER JOIN roles r ON ur.role_id = r.id
INNER JOIN users u ON ur.user_id = u.id
WHERE u.id = 1;
-- Doit montrer 1 rôle assigné

-- 5. Tester la connexion
-- Se déconnecter puis se reconnecter avec ce compte
-- Vérifier que l'accès fonctionne normalement
```

### Option B: Migrer TOUS les utilisateurs (Après tests concluants)

```sql
-- 1. Backup final avant migration massive
-- (À faire en ligne de commande, voir Étape 1)

-- 2. Migrer tous les utilisateurs
CALL migrate_all_users_to_rbac();
-- Peut prendre 1-2 minutes selon le nombre d'utilisateurs

-- 3. Vérifier que tous les utilisateurs sont migrés
SELECT rbac_enabled, COUNT(*) as nb_users
FROM users
GROUP BY rbac_enabled;
-- Doit montrer: rbac_enabled=1 pour TOUS les utilisateurs

-- 4. Vérifier aucun utilisateur sans rôle
SELECT u.id, u.username, u.role
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
WHERE u.rbac_enabled = 1 AND ur.id IS NULL;
-- Doit retourner 0 résultats

-- 5. Statistiques de migration
SELECT r.display_name, COUNT(*) as nb_users
FROM user_roles ur
INNER JOIN roles r ON ur.role_id = r.id
GROUP BY r.id
ORDER BY nb_users DESC;
```

## 🔧 Phase 4: Tests fonctionnels

### Test 1: Créer un rôle personnalisé "Visualisateur Catalogues"

1. Accéder à http://localhost:3000/admin/roles/vue
2. Cliquer sur "Nouveau rôle"
3. Remplir:
   - Nom: `catalog_viewer`
   - Nom d'affichage: `Visualisateur de Catalogues`
   - Description: `Peut uniquement consulter les catalogues et produits`
4. Dans les permissions, cocher:
   - Module "catalogues": `catalogues.view`
   - Module "products": `products.view`
   - Module "categories": `categories.view`
5. Cliquer sur "Créer"
6. ✅ Le rôle doit apparaître dans la liste

### Test 2: Assigner plusieurs rôles à un utilisateur

1. Accéder à la liste des utilisateurs
2. Choisir un utilisateur test
3. Cliquer sur "Gérer les rôles"
4. Assigner les rôles: `utilisateur` + `catalog_viewer`
5. ✅ Les 2 rôles doivent apparaître
6. ✅ Les permissions effectives doivent montrer le cumul des deux rôles

### Test 3: Vérifier les permissions effectives

```sql
-- Vérifier les permissions de l'utilisateur test
SELECT u.username, p.name as permission, r.display_name as from_role
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id
INNER JOIN roles r ON ur.role_id = r.id
INNER JOIN role_permissions rp ON rp.role_id = r.id
INNER JOIN permissions p ON rp.permission_id = p.id
WHERE u.id = [USER_ID]
ORDER BY p.module, p.name;
```

### Test 4: Retirer un rôle

1. Depuis la page de gestion des rôles utilisateur
2. Cliquer sur le bouton "Supprimer" (icône poubelle) d'un rôle
3. Confirmer la suppression
4. ✅ Le rôle doit disparaître
5. ✅ Les permissions effectives doivent être mises à jour

### Test 5: Tentative de modification d'un rôle système

1. Depuis la page des rôles
2. Essayer de cliquer sur "Éditer" pour un rôle système
3. ✅ Le bouton doit être désactivé ou afficher un message d'erreur

## 🛡️ Phase 5: Tests de sécurité

### Test 1: Isolation des organisations

```sql
-- Créer un rôle custom pour l'organisation 1
INSERT INTO roles (name, display_name, organization_id, is_system)
VALUES ('org1_custom', 'Rôle Org 1', 1, 0);

-- Vérifier qu'un admin de l'organisation 2 ne peut pas le voir
-- (à tester via l'interface en se connectant avec un compte org 2)
```

### Test 2: Tentative d'escalation de privilèges

```sql
-- Un admin ne doit PAS pouvoir s'assigner le rôle super_admin
-- À tester via l'interface: essayer d'assigner super_admin à soi-même
-- ✅ Doit être refusé
```

### Test 3: Audit log

```sql
-- Vérifier que les actions sont loggées
SELECT event_type, user_id, actor_id, permission_name, created_at
FROM permission_audit_log
ORDER BY created_at DESC
LIMIT 20;

-- Doit montrer les créations de rôles, assignations, etc.
```

## 🚨 Rollback (En cas de problème)

### Rollback complet

```sql
-- Désactiver RBAC pour tous les utilisateurs (revenir au système legacy)
UPDATE users SET rbac_enabled = 0;

-- L'application continue de fonctionner normalement avec users.role
```

### Restaurer depuis backup

```bash
# Si problème critique, restaurer le backup
mysql -u root -p coopaz < backup_pre_rbac_YYYYMMDD_HHMMSS.sql

# Redémarrer l'application
pm2 restart coopaz
```

## 📈 Monitoring post-déploiement

### Vérifier les performances

```sql
-- 1. Cache hit rate (après 1h d'utilisation)
SELECT COUNT(*) as cache_entries FROM permission_cache;
-- Doit avoir des entrées si cache fonctionne

-- 2. Vérifier aucune erreur dans l'audit log
SELECT COUNT(*) as nb_errors
FROM permission_audit_log
WHERE result = 'error'
  AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
-- Doit être 0

-- 3. Voir les refus de permission (pour détecter problèmes config)
SELECT permission_name, COUNT(*) as nb_denials, COUNT(DISTINCT user_id) as affected_users
FROM permission_audit_log
WHERE event_type = 'permission_check_denied'
  AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
GROUP BY permission_name
ORDER BY nb_denials DESC;
```

## ✨ Prochaines étapes

Une fois le système RBAC validé:

1. ✅ Former les administrateurs (créer rôles custom, assigner rôles)
2. ✅ Créer des rôles métier spécifiques selon besoins
3. ⏭️ (Optionnel) Convertir routes existantes vers `requirePermission()`
4. ⏭️ Préparer modules futurs (POS, Inventory, Stock)

## 📞 Support

- Documentation complète: `/docs/RBAC_IMPLEMENTATION.md`
- Plan détaillé: `/docs/plans/cozy-knitting-nova.md`
- Logs audit: Table `permission_audit_log`

---

**Status actuel:** ✅ Infrastructure complète - Prêt pour tests
**Prochaine étape:** Exécuter la migration SQL (Étape 2)
