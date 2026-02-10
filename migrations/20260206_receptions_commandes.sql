-- =============================================
-- MIGRATION: Réceptions de commandes
-- =============================================
-- Description: Tables pour enregistrer les réceptions (BL, fournisseur,
--              lignes produit / qté / prix) et historiser. La validation
--              met à jour les stocks et crée des mouvements de type 'reception'.
-- Date: 2026-02-06
-- =============================================

-- 1. Table receptions (en-tête d'une réception)
CREATE TABLE IF NOT EXISTS receptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  supplier_id INT NOT NULL,
  bl_number VARCHAR(100) NOT NULL COMMENT 'Numéro du bon de livraison',
  is_from_preorder TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = réception issue d''une précommande',
  statut ENUM('draft', 'validated') NOT NULL DEFAULT 'draft',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validated_at TIMESTAMP NULL,
  validated_by INT NULL,
  comment TEXT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (validated_by) REFERENCES users(id),
  INDEX idx_org (organization_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_statut (statut),
  INDEX idx_created_at (created_at),
  INDEX idx_bl (bl_number(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table reception_lignes (lignes produits d'une réception)
CREATE TABLE IF NOT EXISTS reception_lignes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reception_id INT NOT NULL,
  product_id INT NOT NULL,
  quantite_recue DECIMAL(10,3) NOT NULL DEFAULT 0,
  prix_unitaire DECIMAL(10,4) NOT NULL DEFAULT 0 COMMENT 'Prix à la réception',
  prix_base DECIMAL(10,4) NULL COMMENT 'Prix en base produit (snapshot pour comparaison)',
  comment TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reception_id) REFERENCES receptions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_reception (reception_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Ajouter le type 'reception' aux mouvements de stock
ALTER TABLE stock_movements
  MODIFY COLUMN type ENUM('vente', 'ajustement', 'inventaire', 'reception') NOT NULL;

-- FIN
SELECT 'Migration 20260206_receptions_commandes.sql terminée.' AS message;
