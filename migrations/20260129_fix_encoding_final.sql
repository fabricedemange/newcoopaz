-- Fix encoding issues - recreate all macro permissions with correct UTF-8

-- Desactiver les permissions avec problèmes d'encodage
UPDATE permissions SET is_active = 0 WHERE name IN (
  'pos.create_sale',
  'pos.manage_cash',
  'pos.cancel_sale',
  'pos.print_receipt',
  'stock.transfer',
  'stock.adjust',
  'stock.set_alerts'
);

-- Supprimer et recréer avec le bon encodage
DELETE FROM permissions WHERE name IN (
  'pos.create_sale',
  'pos.manage_cash',
  'pos.cancel_sale',
  'pos.print_receipt',
  'stock.transfer',
  'stock.adjust',
  'stock.set_alerts',
  'inventory.approve'
);

INSERT INTO permissions (name, display_name, description, module, is_active) VALUES
('pos.create_sale', 'Créer une vente', 'Créer une vente', 'pos', 1),
('pos.manage_cash', 'Gérer la caisse', 'Gérer la caisse', 'pos', 1),
('pos.cancel_sale', 'Annuler une vente', 'Annuler une vente', 'pos', 1),
('pos.print_receipt', 'Imprimer ticket', 'Imprimer un ticket de caisse', 'pos', 1),
('stock.transfer', 'Transférer du stock', 'Transférer du stock', 'stock', 1),
('stock.adjust', 'Ajuster le stock', 'Effectuer des ajustements de stock', 'stock', 1),
('stock.set_alerts', 'Configurer alertes stock', 'Configurer les alertes de stock bas', 'stock', 1),
('inventory.approve', 'Approuver un inventaire', 'Approuver et finaliser un inventaire', 'inventory', 1);

-- Vider le cache
TRUNCATE TABLE permission_cache;
