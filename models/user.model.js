// Modèle utilisateur multi-tenant
// Table: users

module.exports = (db) => {
  return {
    create: async (user) => {
      const { username, email, password, role, organization_id } = user;
      const [result] = await queryWithUser(
        "INSERT INTO users (username, email, password, role, organization_id) VALUES (?, ?, ?, ?, ?)",
        [username, email, password, role, organization_id]
      ,req);
      return result.insertId;
    },
    getByOrganization: async (organization_id) => {
      const [rows] = await db.query(
        "SELECT * FROM users WHERE organization_id = ?",
        [organization_id]
      );
      return rows;
    },
    getById: async (id) => {
      const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
      return rows[0];
    },
  };
};
