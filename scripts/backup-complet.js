/**
 * Backup complet : base de données + projet (avant migration ou opération risquée).
 *
 * 1. Base : mysqldump vers backups/<DB_NAME>_YYYYMMDD_HHMMSS.sql
 * 2. Projet : archive git (ou tar du répertoire) vers backups/project_YYYYMMDD_HHMMSS.tar.gz
 *
 * Usage: node scripts/backup-complet.js
 * Variables d'environnement: DB_HOST, DB_USER, DB_PASS, DB_NAME (pour mysqldump)
 * Si MySQL est en local et la connexion échoue (socket), essayer DB_HOST=127.0.0.1 dans .env.
 */

require("dotenv").config();
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BACKUPS_DIR = path.join(ROOT, "backups");

function timestamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}_${h}${min}${s}`;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (opts.env) Object.assign(env, opts.env);
    const child = spawn(cmd, args, {
      stdio: opts.silent ? "pipe" : "inherit",
      shell: opts.shell ?? false,
      env,
      cwd: opts.cwd || ROOT,
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function main() {
  const ts = timestamp();
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log("📁 Dossier backups/ créé.");
  }

  console.log("\n📦 Backup complet —", new Date().toISOString());
  console.log("   Dossier:", BACKUPS_DIR, "\n");

  // 1. Backup base de données (mysqldump)
  const dbName = process.env.DB_NAME || "coopazfr_commandes";
  const dbHost = process.env.DB_HOST || "localhost";
  const dbUser = process.env.DB_USER;
  const dbPass = process.env.DB_PASS;

  const sqlFile = path.join(BACKUPS_DIR, `${dbName}_${ts}.sql`);
  let dbBackupOk = false;
  if (dbUser) {
    console.log("1. Backup base de données…");
    const args = [
      "-h", dbHost,
      "-u", dbUser,
      "--single-transaction",
      "--triggers",
      "--default-character-set=utf8mb4",
      "--skip-ssl",
      dbName,
    ];
    const env = { ...process.env };
    if (dbPass) env.MYSQL_PWD = dbPass;
    try {
      const dump = spawn("mysqldump", args, {
        stdio: ["ignore", fs.openSync(sqlFile, "w"), "pipe"],
        env,
      });
      const stderr = [];
      dump.stderr.on("data", (ch) => stderr.push(ch));
      await new Promise((resolve, reject) => {
        dump.on("close", (code) => {
          if (code !== 0) reject(new Error(Buffer.concat(stderr).toString() || `mysqldump exit ${code}`));
          else resolve();
        });
      });
      const stat = fs.statSync(sqlFile);
      console.log("   ✓", path.basename(sqlFile), `(${(stat.size / 1024 / 1024).toFixed(2)} Mo)\n`);
      dbBackupOk = true;
    } catch (err) {
      console.error("   ❌", err.message);
      console.log("   Si MySQL est en local, vérifier que le serveur tourne et que DB_HOST/DB_USER/DB_PASS sont corrects dans .env.\n");
    }
  } else {
    console.log("1. Backup base : DB_USER non défini (.env) — mysqldump ignoré.");
    console.log("   Pour sauvegarder la base à la main :");
    console.log("   mysqldump -u <user> -p", dbName, "> backups/" + dbName + "_" + ts + ".sql\n");
  }

  // 2. Backup projet (git archive ou tar)
  const projectArchive = path.join(BACKUPS_DIR, `project_${ts}.tar.gz`);
  const gitDir = path.join(ROOT, ".git");
  if (fs.existsSync(gitDir)) {
    console.log("2. Backup projet (git archive)…");
    await run("git", ["archive", "--format=tar.gz", "-o", projectArchive, "HEAD"], { cwd: ROOT });
    const stat = fs.statSync(projectArchive);
    console.log("   ✓", path.basename(projectArchive), `(${(stat.size / 1024).toFixed(1)} Ko)\n`);
  } else {
    console.log("2. Backup projet : pas de dépôt git — création d’une archive tar du répertoire (hors node_modules)…");
    const tar = spawn("tar", [
      "-czf", projectArchive,
      "--exclude=node_modules",
      "--exclude=.git",
      "--exclude=backups",
      "-C", ROOT,
      ".",
    ], { stdio: "inherit", cwd: ROOT });
    await new Promise((resolve, reject) => {
      tar.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`tar exit ${code}`))));
    });
    const stat = fs.statSync(projectArchive);
    console.log("   ✓", path.basename(projectArchive), `(${(stat.size / 1024).toFixed(1)} Ko)\n`);
  }

  console.log("✓ Backup terminé.");
  console.log("  Fichiers :", BACKUPS_DIR);
  console.log("  Vérifier la taille des fichiers avant de lancer une migration.\n");
  if (!dbBackupOk && dbUser) process.exit(1);
}

main().catch((err) => {
  console.error("❌ Erreur:", err.message);
  process.exit(1);
});
