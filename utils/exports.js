const { db } = require("../config/db-trace-wrapper");
const PdfPrinter = require("pdfmake");
const { logger } = require("../config/logger");
const { sendEmail } = require("../services/email.service");
const { getCurrentOrgId } = require("./session-helpers");

// Helper function pour envoyer des emails (copié depuis admin.routes.js)
function envoimail(to, subject, text, attachment, { initiatedBy } = {}) {
  const normalizeRecipients = (raw) => {
    if (!raw) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw.filter(Boolean);
    }
    if (typeof raw === "string") {
      return raw
        .split(/[,;]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  };

  const recipients = normalizeRecipients(to);
  if (!recipients.length) {
    return Promise.resolve([]);
  }

  const baseHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h1 style="color:blue;">Bonjour !</h1>
        ${text}
        <p>Retrouvez vos informations en ligne sur <a href="https://cde.coopaz.fr" style="color: #007bff; text-decoration: none;">Coopaz.fr</a>.</p>
      </body>
      </html>
    `;

  const jobs = recipients.map((recipient) => {
    const mailOptions = {
      from: "contact@coopaz.fr",
      to: recipient,
      subject,
      html: baseHtml,
      initiatedBy: initiatedBy || null,
      sendNow: true,
    };

    if (attachment && attachment.length > 0) {
      mailOptions.attachments = [
        {
          filename: "synthese.pdf",
          content: attachment,
        },
      ];
    }

    return sendEmail(mailOptions);
  });

  return Promise.all(jobs);
}

// Configuration PDF printer
const fonts = {
  Roboto: {
    normal: "./fonts/Roboto-Regular.ttf",
    bold: "./fonts/Roboto-Bold.ttf",
    italics: "./fonts/Roboto-ExtraBoldItalic.ttf",
    bolditalics: "./fonts/Roboto-Light.ttf",
  },
};
const printer = new PdfPrinter(fonts);

function createPdfBuffer(docDefinition) {
  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on("data", (chunk) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function toFrDate(dateValue) {
  if (!dateValue) {
    return "Non définie";
  }
  try {
    return new Date(dateValue).toLocaleDateString("fr-FR");
  } catch (err) {
    return "Non définie";
  }
}

async function generateCatalogueSynthesisPdfBuffer(catalogueId, type) {
  const normalizedType = type === "detailed" ? "detailed" : "simple";

  const catalogue = await new Promise((resolve, reject) => {
    db.query(
      `SELECT cf.originalname, cf.expiration_date, cf.date_livraison, u.username as referent_name, o.email as organization_email, o.name as organization_name
       FROM catalog_files cf 
       LEFT JOIN users u ON cf.uploader_id = u.id 
       LEFT JOIN organizations o ON cf.organization_id = o.id 
       WHERE cf.id = ?`,
      [catalogueId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows && rows.length ? rows[0] : {});
      }
    );
  });

  const catalogueName = catalogue.originalname || `Catalogue N°${catalogueId}`;
  const expirationDate = toFrDate(catalogue.expiration_date);
  const livraisonDate = toFrDate(catalogue.date_livraison);
  const referentName = catalogue.referent_name || "Non défini";

  let query;
  let querySynthese;
  let tableBody;
  let downloadFilename;
  let title;

  if (normalizedType === "simple") {
    // Requête pour le tableau de synthèse (regroupé sans notes)
    querySynthese = `SELECT p.nom as produit, cp.prix, cp.unite,
           SUM(pa.quantity) AS total_commande
FROM catalog_products cp
JOIN products p ON cp.product_id = p.id
JOIN panier_articles pa ON pa.catalog_product_id = cp.id
JOIN paniers pan ON pa.panier_id = pan.id
WHERE cp.catalog_file_id = ? AND pan.is_submitted = 1
GROUP BY cp.id
ORDER BY p.nom ASC`;

    // Requête pour le tableau détaillé (avec notes)
    query = `SELECT p.nom as produit, substring(p.description, 1, 100) as description, cp.prix,
           COALESCE(NULLIF(pan.note, ''), '') AS note,
           pa.note as note_article,
           SUM(pa.quantity) AS total_commande
FROM catalog_products cp
JOIN products p ON cp.product_id = p.id
JOIN panier_articles pa ON pa.catalog_product_id = cp.id
JOIN paniers pan ON pa.panier_id = pan.id
WHERE cp.catalog_file_id = ? AND pan.is_submitted = 1
GROUP BY cp.id, pan.note, pa.note
ORDER BY p.nom ASC`;

    tableBody = (rows) => [
      ["Produit", "Prix (€)", "Quantité", "Note Commande", "Note Article"],
      ...rows.map((row) => [
        row.produit || "",
        row.prix != null ? row.prix : "",
        row.total_commande != null ? row.total_commande : "",
        row.note || "",
        row.note_article || "",
      ]),
    ];

    downloadFilename = "exportsimple.pdf";
    title = `Export simplifié - ${catalogueName} (${catalogueId})`;
  } else {
    query = `SELECT CONCAT(u.username, ' (panier N°', c.id, ')') as username, p.nom as produit, substring(p.description, 1, 100) as description, cp.prix,
           SUM(pa.quantity) as quantite,
           ROUND(SUM(pa.quantity * cp.prix), 2) as montant_utilisateur, COALESCE(c.note, '') AS note, pa.note as note_article
    FROM paniers c
    JOIN panier_articles pa ON pa.panier_id = c.id
    JOIN catalog_products cp ON pa.catalog_product_id = cp.id
    JOIN products p ON cp.product_id = p.id
    JOIN users u ON c.user_id = u.id
    WHERE cp.catalog_file_id = ? and c.is_submitted=1
    GROUP BY u.id, cp.id, c.id
    ORDER BY c.id ASC, p.nom ASC`;

    tableBody = (rows) => [
      [
        "Utilisateur",
        "Produit",
        "Prix (€)",
        "Quantité",
        "Montant (€)",
        "Note Commande",
        "Note Article",
      ],
      ...rows.map((row) => [
        row.username,
        row.produit,
        row.prix,
        row.quantite,
        row.montant_utilisateur,
        row.note,
        row.note_article,
      ]),
    ];

    downloadFilename = "ExportDétaillé.pdf";
    title = `Export détaillé - ${catalogueName} (${catalogueId})`;
  }

  const rows = await new Promise((resolve, reject) => {
    db.query(query, [catalogueId], (err, result) => {
      if (err) return reject(err);
      resolve(result || []);
    });
  });

  // Pour le mode simple, récupérer aussi les données de synthèse
  let rowsSynthese = [];
  if (normalizedType === "simple") {
    rowsSynthese = await new Promise((resolve, reject) => {
      db.query(querySynthese, [catalogueId], (err, result) => {
        if (err) return reject(err);
        resolve(result || []);
      });
    });
  }

  const content = [
    {
      text: title,
      fontSize: 11,
      bold: true,
      margin: [0, 0, 0, 8],
    },
    {
      text: `Référent: ${referentName} | Expiration: ${expirationDate} | Livraison: ${livraisonDate}`,
      fontSize: 9,
      margin: [0, 0, 0, 12],
      color: "#666666",
    },
  ];

  // Ajouter le tableau de synthèse pour l'export simple
  if (normalizedType === "simple" && rowsSynthese.length > 0) {
    content.push({
      text: "SYNTHÈSE GLOBALE",
      fontSize: 9,
      bold: true,
      margin: [0, 0, 0, 6],
    });

    content.push({
      table: {
        headerRows: 1,
        fontSize: 7,
        widths: ["*", "auto", "auto"],
        body: [
          ["Produit", "Prix (€)", "Quantité totale"],
          ...rowsSynthese.map((row) => [
            row.produit || "",
            row.prix != null ? row.prix : "",
            row.total_commande != null ? row.total_commande : "",
          ]),
        ],
      },
      layout: {
        paddingLeft: function () {
          return 3;
        },
        paddingRight: function () {
          return 3;
        },
        paddingTop: function () {
          return 2;
        },
        paddingBottom: function () {
          return 2;
        },
      },
      margin: [0, 0, 0, 15],
    });

    content.push({
      text: "DÉTAIL AVEC NOTES",
      fontSize: 9,
      bold: true,
      margin: [0, 0, 0, 6],
    });
  }

  // Ajouter le tableau principal
  content.push({
    table: {
      headerRows: 1,
      fontSize: 7,
      widths:
        normalizedType === "simple"
          ? ["*", "auto", "auto", "*", "*"]
          : ["*", "*", "auto", "auto", "auto", "*", "*"],
      body: tableBody(rows),
    },
    layout: {
      paddingLeft: function () {
        return 3;
      },
      paddingRight: function () {
        return 3;
      },
      paddingTop: function () {
        return 2;
      },
      paddingBottom: function () {
        return 2;
      },
    },
  });

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [20, 30, 20, 30],
    content: content,
    defaultStyle: {
      fontSize: 7,
      lineHeight: 1.2,
    },
    styles: {
      header: {
        fontSize: 8,
        bold: true,
      },
    },
  };

  const pdfBuffer = await createPdfBuffer(docDefinition);

  return {
    pdfBuffer,
    title,
    downloadFilename,
    catalogueName,
    organizationEmail: catalogue.organization_email,
    organizationName: catalogue.organization_name,
    referentName,
    expirationDate,
    livraisonDate,
  };
}

/**
 * Generate and send PDF for catalogue synthesis
 * @param {number} catalogueId - Catalogue ID
 * @param {string} type - 'simple' or 'detailed'
 * @param {string} action - 'M' for email, 'D' for download
 * @param {Object} res - Response object
 * @param {Object} req - Request object (for session)
 */
function generateAndSendPdf(catalogueId, type, action, res, req) {
  if (action !== "M") action = "D";

  generateCatalogueSynthesisPdfBuffer(catalogueId, type)
    .then(({ pdfBuffer, downloadFilename, organizationEmail }) => {
      if (action === "M") {
        db.query(
          `SELECT originalname, description FROM catalog_files WHERE id = ? AND organization_id = ?`,
          [catalogueId, getCurrentOrgId(req)],
          (err, rowsMail) => {
            if (err || !rowsMail || !rowsMail[0]) {
              return res.status(500).send("Erreur SQL (catalog_files)");
            }
            const cleanSubject = (str) =>
              (str || "")
                .replace(/[\r\n\t]/g, " ")
                .replace(/[<>:"/\\|?*]/g, "-")
                .replace(/[\u0000-\u001F\u007F]/g, "")
                .trim()
                .slice(0, 200);
            const subject =
              (type === "simple"
                ? `Réception Produits : `
                : "Réception produits : ") +
              cleanSubject(
                rowsMail[0].originalname || "catalogue_" + catalogueId
              );
            envoimail(
              organizationEmail,
              subject,
              "Veuillez trouver en pièce jointe le détail de la commande citée en objet",
              pdfBuffer,
              {
                initiatedBy: req.session?.username || null,
              }
            ).catch((err) =>
              logger.error(`Failed to send ${type} PDF email`, err)
            );
            res.send("Mail envoyé !");
          }
        );
        return;
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${downloadFilename}"`
      );
      res.send(pdfBuffer);
    })
    .catch((err) => {
      logger.error("PDF export failed", { error: err?.message });
      res.status(500).send("Erreur lors de la génération du PDF");
    });
}

module.exports = {
  generateAndSendPdf,
  generateCatalogueSynthesisPdfBuffer,
};
