-- =============================================
-- Migration: Cotisation mensuelle caisse (5-15 €)
-- =============================================
-- Une fois par mois, l'utilisateur doit s'acquitter d'une cotisation
-- entre 5 et 15 € au choix lors d'un passage en caisse.
-- =============================================

-- Colonne is_cotisation sur lignes_vente (ligne spéciale "Cotisation mensuelle")
-- À exécuter une seule fois ; si la colonne existe déjà, ignorer l'erreur.
ALTER TABLE lignes_vente
  ADD COLUMN is_cotisation BOOLEAN DEFAULT FALSE
  COMMENT '1 = ligne cotisation mensuelle (5-15 €)'
  AFTER montant_ttc;

SELECT 'Migration add_cotisation_caisse.sql terminée.' AS message;
