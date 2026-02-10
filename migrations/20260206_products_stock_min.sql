-- Migration: Seuil de stock (alerte) distinct du minimum de vente
-- quantite_min = minimum de vente (pas d'incrément à la caisse).
-- stock_min = seuil d'alerte stock (en dessous → produit à recommander / en limite).

ALTER TABLE products
  ADD COLUMN stock_min DECIMAL(10,3) NULL DEFAULT NULL
  COMMENT 'Seuil d''alerte stock : en dessous, le produit est considéré à recommander (NULL = pas d''alerte)'
  AFTER quantite_min;

SELECT 'Migration 20260206_products_stock_min.sql terminée.' AS message;
