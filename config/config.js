require("dotenv").config();
const mysql = require("mysql2");

// Configuration de la connexion MySQL
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  multipleStatements: false,
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0
});

// Force UTF-8 encoding on every new connection
db.on('connection', (connection) => {
  connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci', (err) => {
    if (err) console.error('Erreur SET NAMES:', err);
  });
  connection.query('SET CHARACTER SET utf8mb4', (err) => {
    if (err) console.error('Erreur SET CHARACTER SET:', err);
  });
  connection.query('SET character_set_connection=utf8mb4', (err) => {
    if (err) console.error('Erreur SET character_set_connection:', err);
  });
});

// Gestion d'erreur globale sur le pool
db.on("error", (err) => {
  console.error("Erreur MySQL (pool) :", err);
});

// Exporter la connexion database
module.exports = {
  db,
};

