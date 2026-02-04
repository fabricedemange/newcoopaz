const { db } = require("../config/db-trace-wrapper");

/**
 * Récupère la liste des utilisateurs connectés (sessions actives).
 * @param {Function} callback - (err, connectedUsers)
 */
function getConnectedUsers(callback) {
  const sql = "SELECT session_id, expires, data FROM sessions WHERE expires > UNIX_TIMESTAMP(NOW())";
  db.query(sql, [], (err, rows) => {
    if (err) return callback(err, []);
    const byUser = new Map();
    for (const row of rows || []) {
      let data;
      try {
        data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      } catch (_) {
        continue;
      }
      const userId = data.userId;
      if (userId == null) continue;
      const username = data.username || `#${userId}`;
      const organization_id = data.organization_id ?? null;
      const expires = row.expires ? new Date(row.expires * 1000) : null;
      if (!byUser.has(userId)) {
        byUser.set(userId, {
          userId,
          username,
          organization_id,
          sessionCount: 0,
          maxExpires: expires,
        });
      }
      const u = byUser.get(userId);
      u.sessionCount += 1;
      if (expires && (!u.maxExpires || expires > u.maxExpires)) u.maxExpires = expires;
    }
    const connectedUsers = Array.from(byUser.values());
    const orgIds = [...new Set(connectedUsers.map((u) => u.organization_id).filter(Boolean))];
    if (orgIds.length === 0) {
      connectedUsers.forEach((u) => { u.organizationName = null; });
      return callback(null, connectedUsers);
    }
    const placeholders = orgIds.map(() => "?").join(",");
    db.query(
      `SELECT id, name FROM organizations WHERE id IN (${placeholders})`,
      orgIds,
      (err2, orgRows) => {
        if (err2) connectedUsers.forEach((u) => { u.organizationName = null; });
        else {
          const orgNames = new Map((orgRows || []).map((r) => [r.id, r.name]));
          connectedUsers.forEach((u) => {
            u.organizationName = u.organization_id ? orgNames.get(u.organization_id) || null : null;
          });
        }
        callback(null, connectedUsers);
      }
    );
  });
}

module.exports = {
  getConnectedUsers,
};
