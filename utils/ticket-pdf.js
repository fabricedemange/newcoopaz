const { createPdfBuffer } = require('../services/pdf.service');

/**
 * Génère un PDF pour un ticket de vente
 * @param {Object} venteDetails - Détails complets de la vente (vente, lignes, paiements)
 * @returns {Promise<Buffer>} - Buffer du PDF
 */
async function generateTicketPdf(venteDetails) {
  const { vente, lignes, paiements } = venteDetails;

  // Construction du document pdfmake
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      // Header
      {
        text: 'TICKET DE CAISSE',
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },

      // Informations générales
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: `Ticket n°: ${vente.numero_ticket}`, bold: true },
              { text: `Date: ${formatDate(vente.created_at)}` },
              { text: `Client: ${vente.nom_client || 'Anonyme'}` }
            ]
          },
          {
            width: '50%',
            stack: [
              { text: `Caissier: ${vente.caissier_nom || 'N/A'}` },
              { text: `Source: ${vente.source || 'caisse'}` }
            ]
          }
        ],
        margin: [0, 0, 0, 20]
      },

      // Tableau des produits
      {
        text: 'Articles',
        style: 'subheader',
        margin: [0, 10, 0, 5]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            // Header
            [
              { text: 'Produit', bold: true },
              { text: 'Quantité', bold: true, alignment: 'right' },
              { text: 'Prix unitaire', bold: true, alignment: 'right' },
              { text: 'Total', bold: true, alignment: 'right' }
            ],
            // Lignes de produits
            ...lignes.map(l => [
              l.nom_produit + (l.is_avoir ? ' (AVOIR)' : ''),
              { text: parseFloat(l.quantite).toFixed(3), alignment: 'right' },
              { text: `${parseFloat(l.prix_unitaire).toFixed(2)}€`, alignment: 'right' },
              { text: `${parseFloat(l.montant_ttc).toFixed(2)}€`, alignment: 'right', color: l.is_avoir ? 'red' : 'black' }
            ])
          ]
        },
        margin: [0, 0, 0, 20]
      },

      // Total
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: {
              widths: ['auto', 'auto'],
              body: [
                [
                  { text: 'TOTAL TTC:', bold: true, alignment: 'right' },
                  { text: `${parseFloat(vente.montant_ttc).toFixed(2)}€`, bold: true, fontSize: 14, alignment: 'right' }
                ]
              ]
            },
            layout: 'noBorders'
          }
        ]
      },

      // Paiements (si montant > 0)
      ...(paiements.length > 0 ? [
        {
          text: 'Paiements',
          style: 'subheader',
          margin: [0, 20, 0, 5]
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Mode de paiement', bold: true }, { text: 'Montant', bold: true, alignment: 'right' }],
              ...paiements.map(p => [
                p.mode_paiement_nom,
                { text: `${parseFloat(p.montant).toFixed(2)}€`, alignment: 'right' }
              ])
            ]
          }
        }
      ] : [])
    ],

    styles: {
      header: {
        fontSize: 18,
        bold: true
      },
      subheader: {
        fontSize: 14,
        bold: true
      }
    }
  };

  return createPdfBuffer(docDefinition);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

module.exports = {
  generateTicketPdf
};
