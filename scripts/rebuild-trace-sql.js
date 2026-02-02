#!/usr/bin/env node

/*
  Reconstruit des requêtes SQL à partir de la table `trace`.

  Contexte (repo) : `trace.query` contient une SQL avec placeholders `?`
  et `trace.params` contient un résumé des paramètres sous forme de chaîne
  joinée par " // " (voir config/db-trace-wrapper.js).

  Usage:
    node scripts/rebuild-trace-sql.js --limit 1000 > trace.sql
    node scripts/rebuild-trace-sql.js --from-id 120000 --to-id 121000 --out ./trace.sql

  Options:
    --limit N        (défaut: 500)
    --from-id N      id minimum inclus
    --to-id N        id maximum inclus
    --out PATH       écrit dans un fichier au lieu de stdout
    --no-comments    n'écrit pas les lignes de commentaires "-- ..."

  Notes:
    - La reconstruction ne peut être parfaite que si `trace.params` contient
      tous les paramètres et qu'aucun paramètre ne contient littéralement " // ".
    - Pour les placeholders en excès: remplace par NULL et ajoute un warning.
*/

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2");
const { db } = require("../config/config");

function parseArgs(argv) {
  const args = {
    limit: 500,
    fromId: null,
    toId: null,
    out: null,
    comments: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--limit") {
      args.limit = Number(argv[++i]);
    } else if (a === "--from-id") {
      args.fromId = Number(argv[++i]);
    } else if (a === "--to-id") {
      args.toId = Number(argv[++i]);
    } else if (a === "--out") {
      args.out = argv[++i];
    } else if (a === "--no-comments") {
      args.comments = false;
    } else if (a === "--help" || a === "-h") {
      args.help = true;
    }
  }

  return args;
}

function splitParams(paramsRaw) {
  if (!paramsRaw) {
    return [];
  }
  const str = String(paramsRaw);
  if (!str.trim()) {
    return [];
  }
  return str.split(" // ");
}

function coerceParam(raw) {
  if (raw === undefined) return null;
  if (raw === null) return null;

  const value = String(raw).trim();
  if (value === "") return "";

  const lower = value.toLowerCase();
  if (lower === "null") return null;
  if (lower === "true") return true;
  if (lower === "false") return false;

  // Nombre (entier / float)
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }

  return value;
}

function replacePlaceholders(sql, params) {
  let out = String(sql);
  let warnings = [];

  const placeholders = (out.match(/\?/g) || []).length;

  for (let idx = 0; idx < placeholders; idx++) {
    const raw = idx < params.length ? params[idx] : undefined;
    const coerced = coerceParam(raw);

    if (raw === undefined) {
      warnings.push(`missing_param_${idx + 1}`);
    }

    // mysql.escape gère correctement NULL, bool, number, string
    const escaped = mysql.escape(coerced);

    const qPos = out.indexOf("?");
    if (qPos === -1) {
      break;
    }

    out = out.slice(0, qPos) + escaped + out.slice(qPos + 1);
  }

  // Paramètres en trop
  if (params.length > placeholders) {
    warnings.push(`extra_params_${params.length - placeholders}`);
  }

  return { sql: out, warnings };
}

function formatComment(meta) {
  const parts = [];
  if (meta.id != null) parts.push(`trace_id=${meta.id}`);
  if (meta.created_at) parts.push(`at=${meta.created_at}`);
  if (meta.username) parts.push(`user=${meta.username}`);
  if (meta.warnings && meta.warnings.length) {
    parts.push(`warnings=${meta.warnings.join(",")}`);
  }
  return `-- ${parts.join(" ")}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    // eslint-disable-next-line no-console
    console.log(`Usage: node scripts/rebuild-trace-sql.js [options]\n\n`);
    // eslint-disable-next-line no-console
    console.log(
      `Options:\n  --limit N\n  --from-id N\n  --to-id N\n  --out PATH\n  --no-comments\n`
    );
    process.exit(0);
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) {
    throw new Error("--limit doit être un nombre > 0");
  }

  const where = [];
  const params = [];

  if (Number.isFinite(args.fromId)) {
    where.push("id >= ?");
    params.push(args.fromId);
  }
  if (Number.isFinite(args.toId)) {
    where.push("id <= ?");
    params.push(args.toId);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `SELECT id, created_at, username, \`query\` AS query_text, params
    FROM trace
    ${whereSql}
    ORDER BY id ASC
    LIMIT ?`;
  params.push(args.limit);

  const pool = db.promise();

  const [rows] = await pool.query(sql, params);

  const lines = [];
  for (const row of rows || []) {
    const template = row.query_text;
    if (!template || !String(template).trim()) {
      continue;
    }

    const paramParts = splitParams(row.params);
    const { sql: reconstructed, warnings } = replacePlaceholders(
      template,
      paramParts
    );

    if (args.comments) {
      lines.push(
        formatComment({
          id: row.id,
          created_at: row.created_at,
          username: row.username,
          warnings,
        })
      );
    }

    const trimmed = reconstructed.trim();
    lines.push(trimmed.endsWith(";") ? trimmed : `${trimmed};`);
  }

  const output = lines.join("\n") + (lines.length ? "\n" : "");

  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.writeFileSync(outPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      db.end();
    } catch (_) {
      // ignore
    }
  });
