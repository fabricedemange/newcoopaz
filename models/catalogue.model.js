// Modèle catalogue multi-tenant
// Table: catalog_files

module.exports = (db) => {
  return {
    create: async (catalogue) => {
      const {
        originalname,
        description,
        expiration_date,
        uploader_id,
        organization_id,
      } = catalogue;
      const [result] = await queryWithUser(
        "INSERT INTO catalog_files (originalname, description, expiration_date, uploader_id, organization_id) VALUES (?, ?, ?, ?, ?)",
        [
          originalname,
          description,
          expiration_date,
          uploader_id,
          organization_id,
        ]
      ,req);
      return result.insertId;
    },
    getByOrganization: async (organization_id) => {
      const [rows] = await db.query(
        "SELECT * FROM catalog_files WHERE organization_id = ?",
        [organization_id]
      );
      return rows;
    },
    getById: async (id) => {
      const [rows] = await db.query(
        "SELECT * FROM catalog_files WHERE id = ?",
        [id]
      );
      return rows[0];
    },
  };
};
