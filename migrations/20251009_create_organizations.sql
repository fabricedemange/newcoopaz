-- Migration SQL pour la table organizations (multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajout du champ organization_id dans la table users
ALTER TABLE users ADD COLUMN organization_id INT NULL,
  ADD CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Ajout du champ organization_id dans la table catalog_files
ALTER TABLE catalog_files ADD COLUMN organization_id INT NULL,
  ADD CONSTRAINT fk_catalog_files_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);
