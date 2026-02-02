const xlsx = require("xlsx");

/**
 * Lit un fichier Excel et retourne les données
 * @param {string} filePath - Chemin du fichier Excel
 * @param {string} sheetName - Nom de la feuille (optionnel, prend la première par défaut)
 * @returns {Array} - Tableau de données
 */
function readExcelFile(filePath, sheetName = null) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheet = sheetName
      ? workbook.Sheets[sheetName]
      : workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      throw new Error("Feuille non trouvée dans le fichier Excel");
    }

    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return rows;
  } catch (error) {
    console.error("Erreur lors de la lecture du fichier Excel:", error);
    throw error;
  }
}

/**
 * Génère un buffer Excel à partir de données JSON
 * @param {Array} data - Tableau d'objets à convertir en Excel
 * @param {string} sheetName - Nom de la feuille (par défaut "Sheet1")
 * @returns {Buffer} - Buffer du fichier Excel
 */
function generateExcelBuffer(data, sheetName = "Sheet1") {
  try {
    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

    const buffer = xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return buffer;
  } catch (error) {
    console.error("Erreur lors de la génération du fichier Excel:", error);
    throw error;
  }
}

/**
 * Génère un fichier Excel de synthèse simple
 * @param {Array} data - Données de la synthèse
 * @returns {Buffer} - Buffer du fichier Excel
 */
function generateSyntheseSimpleExcel(data) {
  const rows = data.map((row) => ({
    "Code Article": row.code_article || "",
    Désignation: row.designation || "",
    "Quantité Totale": row.total_quantity || 0,
  }));

  return generateExcelBuffer(rows, "SyntheseSimple");
}

/**
 * Génère un fichier Excel de synthèse détaillée
 * @param {Array} data - Données de la synthèse
 * @returns {Buffer} - Buffer du fichier Excel
 */
function generateSyntheseDetaileeExcel(data) {
  const rows = data.map((row) => ({
    "Code Article": row.code_article || "",
    Désignation: row.designation || "",
    Utilisateur: row.username || "",
    Groupe: row.groupe_nom || "",
    Quantité: row.quantite || 0,
  }));

  return generateExcelBuffer(rows, "SyntheseDetaillee");
}

/**
 * Génère un fichier Excel de synthèse par utilisateur
 * @param {Array} data - Données de la synthèse
 * @returns {Buffer} - Buffer du fichier Excel
 */
function generateSyntheseUtilisateurExcel(data) {
  const rows = data.map((row) => ({
    Utilisateur: row.username || "",
    Groupe: row.groupe_nom || "",
    "Code Article": row.code_article || "",
    Désignation: row.designation || "",
    Quantité: row.quantite || 0,
  }));

  return generateExcelBuffer(rows, "SyntheseUtilisateur");
}

/**
 * Importe des articles depuis un fichier Excel
 * @param {string} filePath - Chemin du fichier Excel
 * @returns {Object} - Résultat de l'import { success, imported, errors }
 */
function importArticlesFromExcel(filePath) {
  try {
    const rows = readExcelFile(filePath);

    // Supposons que la première ligne contient les en-têtes
    const headers = rows[0];
    const articles = [];
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Validation basique
      if (!row[0] || !row[1]) {
        errors.push(`Ligne ${i + 1}: Code article ou désignation manquant`);
        continue;
      }

      articles.push({
        code_article: row[0],
        designation: row[1],
        prix: parseFloat(row[2]) || 0,
        // Ajoutez d'autres champs selon votre structure
      });
    }

    return {
      success: true,
      imported: articles.length,
      errors: errors,
      articles: articles,
    };
  } catch (error) {
    return {
      success: false,
      imported: 0,
      errors: [error.message],
      articles: [],
    };
  }
}

module.exports = {
  readExcelFile,
  generateExcelBuffer,
  generateSyntheseSimpleExcel,
  generateSyntheseDetaileeExcel,
  generateSyntheseUtilisateurExcel,
  importArticlesFromExcel,
};
