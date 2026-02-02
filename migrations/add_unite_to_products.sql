-- Migration : Ajout des colonnes unite et quantite_min à la table products
-- Date : 2026-01-30
-- Objectif : Permettre la gestion d'unités de mesure et de quantités minimales par produit

-- Ajouter colonnes unite et quantite_min à la table products
ALTER TABLE products
ADD COLUMN unite VARCHAR(50) DEFAULT 'Pièce' AFTER conditionnement,
ADD COLUMN quantite_min DECIMAL(10,3) DEFAULT 1 AFTER unite;

-- Créer index pour performances sur unite
CREATE INDEX idx_products_unite ON products(unite);

-- Mettre à jour les produits existants avec valeurs par défaut
UPDATE products
SET unite = 'Pièce', quantite_min = 1
WHERE unite IS NULL OR quantite_min IS NULL;
