-- =============================================
-- MIGRATION: Tables caisse pour CoopazV13
-- =============================================
-- Description: Création des tables pour le module de caisse
-- Date: 2026-01-30
-- =============================================

-- 1. Modes de paiement
CREATE TABLE IF NOT EXISTS modes_paiement (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  nom VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_org (organization_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Ventes (tickets de caisse)
CREATE TABLE IF NOT EXISTS ventes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  numero_ticket VARCHAR(50) UNIQUE NOT NULL,
  adherent_id INT NULL COMMENT 'NULL = client anonyme',
  nom_client VARCHAR(255),
  montant_ttc DECIMAL(10,2) NOT NULL,
  statut VARCHAR(50) DEFAULT 'complete',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (adherent_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_org (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_numero (numero_ticket),
  INDEX idx_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Lignes de vente (articles du ticket)
CREATE TABLE IF NOT EXISTS lignes_vente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vente_id INT NOT NULL,
  produit_id INT NOT NULL,
  nom_produit VARCHAR(255) NOT NULL,
  quantite DECIMAL(10,3) NOT NULL,
  prix_unitaire DECIMAL(10,2) NOT NULL,
  montant_ttc DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_vente (vente_id),
  INDEX idx_produit (produit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Paiements
CREATE TABLE IF NOT EXISTS paiements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vente_id INT NOT NULL,
  mode_paiement_id INT NOT NULL,
  montant DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
  FOREIGN KEY (mode_paiement_id) REFERENCES modes_paiement(id) ON DELETE RESTRICT,
  INDEX idx_vente (vente_id),
  INDEX idx_mode (mode_paiement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Ajouter colonne stock dans products (si pas présente)
-- Vérifier d'abord si la colonne existe
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @columnname = 'stock';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(10,3) DEFAULT 0 AFTER image_filename')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Ajouter index sur stock si pas présent
SET @indexname = 'idx_stock';
SET @preparedStatement2 = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX ', @indexname, ' (stock)')
));
PREPARE addIndexIfNotExists FROM @preparedStatement2;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

-- 6. Insérer modes de paiement par défaut pour chaque organisation
INSERT INTO modes_paiement (organization_id, nom, icon)
SELECT id, 'Espèces', 'bi-cash-coin' FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM modes_paiement mp
  WHERE mp.organization_id = organizations.id AND mp.nom = 'Espèces'
);

INSERT INTO modes_paiement (organization_id, nom, icon)
SELECT id, 'Carte bancaire', 'bi-credit-card' FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM modes_paiement mp
  WHERE mp.organization_id = organizations.id AND mp.nom = 'Carte bancaire'
);

INSERT INTO modes_paiement (organization_id, nom, icon)
SELECT id, 'Chèque', 'bi-wallet2' FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM modes_paiement mp
  WHERE mp.organization_id = organizations.id AND mp.nom = 'Chèque'
);

-- 7. Créer permission RBAC
INSERT IGNORE INTO permissions (name, description, is_active)
VALUES ('caisse.sell', 'Accès à la caisse pour vendre des produits', TRUE);

-- 8. Assigner permission aux rôles admin et epicier
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'epicier')
  AND p.name = 'caisse.sell';

-- FIN MIGRATION
SELECT 'Migration create_caisse_tables.sql terminée avec succès!' as message;
