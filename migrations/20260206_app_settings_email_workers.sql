-- Paramètres applicatifs pour les workers d'email (remplacent les variables d'env).
-- Les interrupteurs sur /admin/email-queue mettent à jour cette table.

CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` VARCHAR(255) NOT NULL DEFAULT '0',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Valeurs initiales : envoi désactivé (0). 1 = activé.
INSERT IGNORE INTO app_settings (`key`, `value`) VALUES
  ('mail_queue_send_enabled', '0'),
  ('catalogue_order_reminder_enabled', '0');
