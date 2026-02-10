const pdfmake = require("pdfmake");

// Polices requises par pdfmake
const fonts = {
  Roboto: {
    normal: "fonts/Roboto-Regular.ttf",
    bold: "fonts/Roboto-Bold.ttf",
    italics: "fonts/Roboto-Italic.ttf",
    bolditalics: "fonts/Roboto-BoldItalic.ttf",
  },
};

const printer = new pdfmake(fonts);

/**
 * Nettoie une chaîne pour l'utiliser comme nom de fichier
 * @param {string} str - Chaîne à nettoyer
 * @returns {string}
 */
function cleanSubject(str) {
  return str
    .replace(/[\r\n\t]/g, " ") // supprime retour à la ligne/tab
    .replace(/[<>:"/\\|?*]/g, "-") // remplace caractères interdits par '-'
    .replace(/[\u0000-\u001F\u007F]/g, "") // caractères de contrôle ASCII
    .trim()
    .slice(0, 200); // max 200 caractères
}

/**
 * Génère un PDF à partir d'une définition de document
 * @param {Object} docDefinition - Définition du document pdfmake
 * @returns {Promise<Buffer>}
 */
function generatePdf(docDefinition) {
  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];

      pdfDoc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      pdfDoc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });

      pdfDoc.on("error", (err) => {
        reject(err);
      });

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Crée la définition d'un PDF de synthèse simple
 * @param {Object} catalogue - Informations du catalogue
 * @param {Array} data - Données de la synthèse
 * @returns {Object} - Définition du document pdfmake
 */
function createSyntheseSimpleDocDefinition(catalogue, data) {
  const tableBody = [
    [
      { text: "Code Article", style: "tableHeader" },
      { text: "Désignation", style: "tableHeader" },
      { text: "Quantité Totale", style: "tableHeader" },
    ],
  ];

  data.forEach((row) => {
    tableBody.push([
      row.code_article || "",
      row.designation || "",
      {
        text: row.total_quantity ? row.total_quantity.toString() : "0",
        alignment: "right",
      },
    ]);
  });

  return {
    pageOrientation: "portrait",
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        text: "Synthèse Simple des Quantités",
        style: "header",
        alignment: "center",
      },
      {
        text: `Catalogue : ${catalogue.nom}`,
        style: "subheader",
        alignment: "center",
        margin: [0, 10, 0, 20],
      },
      {
        table: {
          headerRows: 1,
          widths: ["auto", "*", "auto"],
          body: tableBody,
        },
        layout: {
          fillColor: function (rowIndex) {
            return rowIndex === 0
              ? "#3498db"
              : rowIndex % 2 === 0
              ? "#ecf0f1"
              : null;
          },
        },
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 14,
        margin: [0, 10, 0, 5],
      },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: "white",
      },
    },
    defaultStyle: {
      fontSize: 10,
    },
  };
}

/**
 * Crée la définition d'un PDF de synthèse détaillée
 * @param {Object} catalogue - Informations du catalogue
 * @param {Array} data - Données de la synthèse
 * @returns {Object} - Définition du document pdfmake
 */
function createSyntheseDetaileeDocDefinition(catalogue, data) {
  const tableBody = [
    [
      { text: "Code Article", style: "tableHeader" },
      { text: "Désignation", style: "tableHeader" },
      { text: "Utilisateur", style: "tableHeader" },
      { text: "Groupe", style: "tableHeader" },
      { text: "Quantité", style: "tableHeader" },
    ],
  ];

  data.forEach((row) => {
    tableBody.push([
      row.code_article || "",
      row.designation || "",
      row.username || "",
      row.groupe_nom || "",
      {
        text: row.quantite ? row.quantite.toString() : "0",
        alignment: "right",
      },
    ]);
  });

  return {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        text: "Synthèse Détaillée des Commandes",
        style: "header",
        alignment: "center",
      },
      {
        text: `Catalogue : ${catalogue.nom}`,
        style: "subheader",
        alignment: "center",
        margin: [0, 10, 0, 20],
      },
      {
        table: {
          headerRows: 1,
          widths: ["auto", "*", "auto", "auto", "auto"],
          body: tableBody,
        },
        layout: {
          fillColor: function (rowIndex) {
            return rowIndex === 0
              ? "#3498db"
              : rowIndex % 2 === 0
              ? "#ecf0f1"
              : null;
          },
        },
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 14,
        margin: [0, 10, 0, 5],
      },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: "white",
      },
    },
    defaultStyle: {
      fontSize: 10,
    },
  };
}

/**
 * Crée la définition d'un PDF de synthèse par utilisateur
 * @param {Object} catalogue - Informations du catalogue
 * @param {Array} data - Données de la synthèse
 * @returns {Object} - Définition du document pdfmake
 */
function createSyntheseUtilisateurDocDefinition(catalogue, data) {
  const tableBody = [
    [
      { text: "Utilisateur", style: "tableHeader" },
      { text: "Groupe", style: "tableHeader" },
      { text: "Code Article", style: "tableHeader" },
      { text: "Désignation", style: "tableHeader" },
      { text: "Quantité", style: "tableHeader" },
    ],
  ];

  data.forEach((row) => {
    tableBody.push([
      row.username || "",
      row.groupe_nom || "",
      row.code_article || "",
      row.designation || "",
      {
        text: row.quantite ? row.quantite.toString() : "0",
        alignment: "right",
      },
    ]);
  });

  return {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        text: "Synthèse par Utilisateur",
        style: "header",
        alignment: "center",
      },
      {
        text: `Catalogue : ${catalogue.nom}`,
        style: "subheader",
        alignment: "center",
        margin: [0, 10, 0, 20],
      },
      {
        table: {
          headerRows: 1,
          widths: ["auto", "auto", "auto", "*", "auto"],
          body: tableBody,
        },
        layout: {
          fillColor: function (rowIndex) {
            return rowIndex === 0
              ? "#3498db"
              : rowIndex % 2 === 0
              ? "#ecf0f1"
              : null;
          },
        },
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 14,
        margin: [0, 10, 0, 5],
      },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: "white",
      },
    },
    defaultStyle: {
      fontSize: 10,
    },
  };
}

/**
 * Crée la définition du PDF d'une commande (panier validé) pour envoi par email
 * @param {Object} commande - { id, username, originalname, created_formatted, livraison_formatted, note, ... }
 * @param {Array} articles - [{ produit, quantity, prix, unite, note, fournisseur, categorie }]
 * @returns {Object} docDefinition pdfmake
 */
function createCommandeDocDefinition(commande, articles) {
  const total = (articles || []).reduce(
    (sum, a) => sum + (parseFloat(a.prix) || 0) * (parseFloat(a.quantity) || 0) * (parseFloat(a.unite) || 1),
    0
  );

  const tableBody = [
    [
      { text: "Produit", style: "tableHeader" },
      { text: "Qté", style: "tableHeader" },
      { text: "Prix / Unité", style: "tableHeader" },
      { text: "Total", style: "tableHeader" },
      { text: "Note", style: "tableHeader" },
    ],
  ];

  (articles || []).forEach((a) => {
    const qty = parseFloat(a.quantity) || 0;
    const prix = parseFloat(a.prix) || 0;
    const unite = parseFloat(a.unite) || 1;
    const ligneTotal = qty * prix * unite;
    tableBody.push([
      { text: (a.produit || "").slice(0, 40), fontSize: 9 },
      { text: String(qty), alignment: "right" },
      { text: `${prix.toFixed(2)} € / ${unite}`, alignment: "right" },
      { text: `${ligneTotal.toFixed(2)} €`, alignment: "right" },
      { text: (a.note || "").slice(0, 25), fontSize: 8 },
    ]);
  });

  const content = [
    { text: "Commande", style: "header", alignment: "center" },
    { text: `#${commande.id} - ${commande.originalname || "Catalogue"}`, style: "subheader", alignment: "center", margin: [0, 4, 0, 12] },
    {
      columns: [
        { text: `Demandeur : ${commande.username || "-"}`, width: "*" },
        { text: `Date : ${commande.created_formatted || "-"}`, width: "*" },
      ],
      margin: [0, 0, 0, 8],
    },
    { text: `Livraison prévue : ${commande.livraison_formatted || "-"}`, margin: [0, 0, 0, 8] },
  ];

  if (commande.note) {
    content.push({ text: `Note : ${commande.note}`, italics: true, margin: [0, 0, 0, 8] });
  }

  content.push(
    {
      table: {
        headerRows: 1,
        widths: ["*", 40, 70, 60, 80],
        body: tableBody,
      },
      layout: {
        fillColor: (rowIndex) => (rowIndex === 0 ? "#3498db" : rowIndex % 2 === 0 ? "#ecf0f1" : null),
      },
    },
    { text: " ", margin: [0, 8] },
    {
      columns: [
        { text: "Total commande", bold: true, width: "*" },
        { text: `${total.toFixed(2)} €`, bold: true, alignment: "right", width: 80 },
      ],
    }
  );

  return {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    content,
    styles: {
      header: { fontSize: 18, bold: true },
      subheader: { fontSize: 12 },
      tableHeader: { bold: true, fontSize: 10, color: "white" },
    },
    defaultStyle: { fontSize: 10 },
  };
}

/** Alias pour generatePdf (utilisé par ticket-pdf) */
const createPdfBuffer = generatePdf;

module.exports = {
  generatePdf,
  createPdfBuffer,
  cleanSubject,
  createSyntheseSimpleDocDefinition,
  createSyntheseDetaileeDocDefinition,
  createSyntheseUtilisateurDocDefinition,
  createCommandeDocDefinition,
  printer,
};
