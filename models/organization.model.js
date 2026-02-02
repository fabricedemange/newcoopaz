// Modèle de base pour la gestion multi-tenant
// Table: organizations

module.exports = (db) => {
  return {
    create: async (name) => {
      const [result] = await queryWithUser(
        "INSERT INTO organizations (name) VALUES (?)",
        [name]
      ,req);
      return result.insertId;
    },
    getAll: async () => {
      const [rows] = await db.query("SELECT * FROM organizations");
      return rows;
    },
    getById: async (id) => {
      const [rows] = await db.query(
        "SELECT * FROM organizations WHERE id = ?",
        [id]
      );
      return rows[0];
    },
  };
};
