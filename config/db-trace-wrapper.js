// Wrapper pour logger toutes les requêtes SQL
const { db } = require("./config");
const fs = require("fs");
const path = require("path");

// Table de log SQL (à créer dans la base si besoin)
// CREATE TABLE IF NOT EXISTS trace_sql (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   username VARCHAR(255),
//   sql_text TEXT,
//   params TEXT
// );
function logSqlToDb(sql, params) {
  const paramsStr = JSON.stringify(params);

  // Insert into trace_sql, then insert into trace only if the first succeeds
  db.query(
    "INSERT INTO trace_sql (sql_text, params) VALUES (?, ?)",
    [sql, paramsStr],
    (err) => {
      if (err) {
        console.error("Erreur insertion trace_sql:", err);
      } else {
        queryWithUser(
          "INSERT INTO trace (username, chemin) VALUES (?, ?)",
          [null, sql],
          (err2) => {
            if (err2) console.error("Erreur insertion trace:", err2);
          },
          req
        );
      }
    }
  );

  // Insert into trace (store chemin as the SQL string, username left null)
  // Adjust values if you want to store different fields (username/role)
  queryWithUser(
    "INSERT INTO trace (username, chemin) VALUES (?, ?)",
    [null, sql],
    (err) => {
      if (err) console.error("Erreur insertion trace:", err);
    },
    req
  );
}

function queryWithTrace(sql, params, callback) {
  //logSqlToDb(sql, params);
  return db.query(sql, params, callback);
}

function queryWithUser(sql, params, callback, req) {
  const username = req?.session?.username || null;
  const userid = req?.session?.userId || null;

  // Ne tracer que les UPDATE, INSERT, DELETE (pas les SELECT)
  const sqlUpper = sql.trim().toUpperCase();
  const shouldTrace = sqlUpper.startsWith('UPDATE') ||
                      sqlUpper.startsWith('INSERT') ||
                      sqlUpper.startsWith('DELETE');

  if (shouldTrace) {
    console.log("TRACE SQL User:", username, "UserID:", userid);
    // On ne stocke qu'un résumé des params (ex: nombre ou type)
    let paramsSummary = "";
    try {
      paramsSummary = Array.isArray(params)
        ? params.slice(0, 10).join(" // ")
        : "";
    } catch (e) {
      paramsSummary = "[unserializable]";
    }
    db.query(
      "INSERT INTO trace (username, query, params) VALUES (?, ?, ?)",
      [username +'(' + userid +')', sql, paramsSummary],
      (err) => {
        if (err) console.error("Erreur insertion trace:", err);
      }
    );
  }

  return db.query(sql, params, callback);
}
module.exports = {
  db,
  queryWithUser,
  queryWithTrace,
};
