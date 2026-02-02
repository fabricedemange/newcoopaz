CREATE TABLE IF NOT EXISTS email_queue (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  status ENUM('pending','sending','sent','error') NOT NULL DEFAULT 'pending',
  from_address VARCHAR(255) NULL,
  to_addresses JSON NOT NULL,
  subject VARCHAR(255) NOT NULL,
  text_body MEDIUMTEXT NULL,
  html_body MEDIUMTEXT NULL,
  attachments JSON NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  scheduled_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_email_queue_status (status),
  KEY idx_email_queue_scheduled_at (scheduled_at),
  KEY idx_email_queue_sent_at (sent_at)
);
