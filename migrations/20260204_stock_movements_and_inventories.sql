-- =============================================
-- MIGRATION: Mouvements de stock et inventaires
-- =============================================
-- Description: Tables pour l'historique des mouvements de stock
--              et des sessions d'inventaire (rapprochement stocks).
-- Date: 2026-02-04
-- =============================================

-- 1. Table stock_movements (historique des changements de stock)
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  product_id INT NOT NULL,
  type ENUM('vente', 'ajustement', 'inventaire') NOT NULL,
  quantite DECIMAL(10,3) NOT NULL COMMENT 'Signée: négatif = sortie',
  stock_avant DECIMAL(10,3) NOT NULL DEFAULT 0,
  stock_apres DECIMAL(10,3) NOT NULL DEFAULT 0,
  reference_type VARCHAR(50) NULL COMMENT 'Ex: vente, inventaire',
  reference_id INT NULL COMMENT 'Ex: vente_id, inventaire_id',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  comment TEXT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_org (organization_id),
  INDEX idx_product (product_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at),
  INDEX idx_reference (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table inventaires (sessions d'inventaire)
CREATE TABLE IF NOT EXISTS inventaires (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  statut ENUM('draft', 'complete') NOT NULL DEFAULT 'draft',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  comment TEXT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_org (organization_id),
  INDEX idx_statut (statut),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Table inventaire_lignes (lignes d'une session d'inventaire)
CREATE TABLE IF NOT EXISTS inventaire_lignes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventaire_id INT NOT NULL,
  product_id INT NOT NULL,
  quantite_comptee DECIMAL(10,3) NOT NULL DEFAULT 0,
  stock_theorique DECIMAL(10,3) NOT NULL DEFAULT 0 COMMENT 'Snapshot au moment du comptage',
  ecart DECIMAL(10,3) NOT NULL DEFAULT 0 COMMENT 'quantite_comptee - stock_theorique',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventaire_id) REFERENCES inventaires(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_inventaire (inventaire_id),
  INDEX idx_product (product_id),
  UNIQUE KEY uk_inventaire_product (inventaire_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FIN
SELECT 'Migration 20260204_stock_movements_and_inventories.sql terminée.' AS message;
