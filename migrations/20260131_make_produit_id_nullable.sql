-- Migration: Rendre produit_id nullable dans lignes_vente pour supporter les avoirs
-- Date: 2026-01-31
-- Description: Les avoirs n'ont pas de produit_id, donc la colonne doit accepter NULL

-- Supprimer la contrainte de clé étrangère existante
ALTER TABLE lignes_vente DROP FOREIGN KEY lignes_vente_ibfk_2;

-- Modifier la colonne pour accepter NULL
ALTER TABLE lignes_vente MODIFY produit_id INT NULL;

-- Recréer la contrainte de clé étrangère
ALTER TABLE lignes_vente
  ADD CONSTRAINT lignes_vente_ibfk_2
  FOREIGN KEY (produit_id) REFERENCES products(id) ON DELETE RESTRICT;
