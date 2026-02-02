-- ============================================================================
-- Migration: Synchroniser les prix de la table articles vers products
-- ============================================================================
-- Objectif: Les imports Google Sheets vont dans 'articles', mais les prix
--           doivent être dans products.prix pour la caisse
-- ============================================================================

-- Mettre à jour products.prix depuis articles en matchant par nom de produit
-- On prend le prix le plus récent (dernier catalog_file_id)
UPDATE products p
INNER JOIN (
  SELECT
    a.produit,
    a.prix,
    cf.organization_id,
    MAX(cf.upload_date) as last_upload
  FROM articles a
  INNER JOIN catalog_files cf ON a.catalog_file_id = cf.id
  WHERE a.prix > 0
  GROUP BY a.produit, cf.organization_id, a.prix
) latest ON
  (
    p.nom = latest.produit
    OR CONCAT(p.nom, '_', p.description, '_', p.unite, '_') = latest.produit
    OR p.nom LIKE CONCAT(SUBSTRING_INDEX(latest.produit, '_', 1), '%')
  )
  AND p.organization_id = latest.organization_id
SET p.prix = latest.prix
WHERE p.prix IS NULL OR p.prix = 0;

-- Afficher le résultat
SELECT
  'Synchronisation terminée' as status,
  COUNT(*) as products_updated
FROM products p
WHERE p.prix > 0 AND p.organization_id = 1;
