const { createPdfBuffer } = require('../services/pdf.service');

/**
 * Génère un PDF pour un ticket de vente
 * @param {Object} venteDetails - Détails complets de la vente (vente, lignes, paiements)
 * @returns {Promise<Buffer>} - Buffer du PDF
 */
async function generateTicketPdf(venteDetails) {
  const { vente, lignes, paiements } = venteDetails;
  const nomClient = vente.client_nom || vente.nom_client || 'Anonyme';

  const content = [
    // Header
    {
      text: 'Détail vente – Ticket de caisse',
      style: 'header',
      alignment: 'center',
      margin: [0, 0, 0, 20]
    },

    // Informations générales (comme la modale)
    {
      text: 'Informations générales',
      style: 'subheader',
      margin: [0, 0, 0, 5]
    },
    {
      stack: [
        { text: `Date/Heure: ${formatDate(vente.created_at)}` },
        { text: `Caissier: ${vente.caissier_nom || 'N/A'}` },
        { text: `Client: ${nomClient}` },
        { text: `Montant total: ${parseFloat(vente.montant_ttc).toFixed(2)} €`, bold: true }
      ],
      margin: [0, 0, 0, 20]
    },

    // Produits vendus (comme la modale)
    {
      text: 'Produits vendus',
      style: 'subheader',
      margin: [0, 10, 0, 5]
    },
    {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'Produit', bold: true },
            { text: 'Quantité', bold: true, alignment: 'right' },
            { text: 'Prix unitaire', bold: true, alignment: 'right' },
            { text: 'Total', bold: true, alignment: 'right' }
          ],
          ...(lignes || []).map(l => {
            const nom = l.nom_produit || l.product_nom_actuel || l.designation || 'Produit';
            const suffix = (l.is_cotisation ? ' (Cotisation)' : '') + (l.is_avoir ? ' (AVOIR)' : '');
            return [
              nom + suffix,
              { text: parseFloat(l.quantite).toFixed(3), alignment: 'right' },
              { text: `${parseFloat(l.prix_unitaire).toFixed(2)} €`, alignment: 'right' },
              { text: `${parseFloat(l.montant_ttc).toFixed(2)} €`, alignment: 'right', color: l.is_avoir ? 'red' : l.is_cotisation ? '#0d6efd' : 'black' }
            ];
          })
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
                { text: 'Total:', bold: true, alignment: 'right' },
                { text: `${parseFloat(vente.montant_ttc).toFixed(2)} €`, bold: true, fontSize: 14, alignment: 'right' }
              ]
            ]
          },
          layout: 'noBorders'
        }
      ]
    }
  ];

  // Paiements (comme la modale)
  if (paiements && paiements.length > 0) {
    content.push(
      { text: 'Paiements', style: 'subheader', margin: [0, 20, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [
            [
              { text: 'Mode de paiement', bold: true },
              { text: 'Montant', bold: true, alignment: 'right' },
              { text: 'Date', bold: true }
            ],
            ...paiements.map(p => [
              p.mode_paiement_nom,
              { text: `${parseFloat(p.montant).toFixed(2)} €`, alignment: 'right' },
              p.date_paiement ? formatDate(p.date_paiement) : ''
            ])
          ]
        }
      }
    );
  }

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content,

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
