-- Corriger email_queue.id : s'assurer que id est clé primaire et AUTO_INCREMENT.
-- MySQL #1075 : la colonne AUTO_INCREMENT doit être indexée (souvent PRIMARY KEY).
-- Si la table a déjà une clé primaire sur une autre colonne, exécuter d'abord la ligne 1.
-- Si la table n'a pas de clé primaire, ignorer la ligne 1 (erreur "Can't DROP" possible).

-- 1. Supprimer l'éventuelle clé primaire existante (si elle n'est pas sur id)
ALTER TABLE email_queue DROP PRIMARY KEY;

-- 2. Mettre id en PRIMARY KEY et AUTO_INCREMENT
ALTER TABLE email_queue
  ADD PRIMARY KEY (id),
  MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;
