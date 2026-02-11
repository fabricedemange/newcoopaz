-- Ajouter colonne remise_pourcent à lignes_vente
ALTER TABLE lignes_vente
  ADD COLUMN remise_pourcent DECIMAL(5,2) NULL DEFAULT 0
  COMMENT 'Remise en pourcentage (0-100)'
  AFTER montant_ttc;
