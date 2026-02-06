-- Paramètres maintenance du site (mode maintenance + message).
-- Uniquement les super admins (organizations.view_all) peuvent accéder au site en maintenance.

INSERT IGNORE INTO app_settings (`key`, `value`) VALUES
  ('maintenance_enabled', '0'),
  ('maintenance_message', 'Le site est actuellement en maintenance. Merci de réessayer plus tard.');
