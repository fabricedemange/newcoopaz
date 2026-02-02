ALTER TABLE catalog_files
  ADD COLUMN referent_order_reminder_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN referent_order_reminder_sent_at DATETIME NULL;
