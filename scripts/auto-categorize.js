/**
 * Système de catégorisation automatique des produits
 * Basé sur l'analyse des noms de produits
 */

// Définition des catégories avec mots-clés et ordre d'affichage
const CATEGORIES = [
  {
    nom: 'Légumineuses',
    ordre: 1,
    couleur: '#8BC34A',
    icon: 'bi-circle',
    keywords: [
      'lentille', 'lentilles', 'pois chiche', 'haricot sec', 'haricots secs',
      'feve', 'feves', 'soja', 'legumineuse'
    ]
  },
  {
    nom: 'Fruits et Légumes',
    ordre: 2,
    couleur: '#4CAF50',
    icon: 'bi-basket',
    keywords: [
      'ail', 'courge', 'radis', 'salade', 'batavia', 'pomme', 'pommes', 'prune', 'prunes',
      'tomate', 'carotte', 'oignon', 'poireau', 'courgette', 'aubergine', 'poivron',
      'fraise', 'cerise', 'kiwi', 'orange', 'citron', 'banane', 'raisin',
      'laitue', 'endive', 'chou', 'brocoli', 'haricot', 'petit pois', 'legume', 'fruit'
    ]
  },
  {
    nom: 'Boissons',
    ordre: 2,
    couleur: '#2196F3',
    icon: 'bi-cup-straw',
    keywords: [
      'cidre', 'jus', 'petillant', 'vin', 'biere', 'limonade', 'sirop',
      'eau', 'the', 'cafe', 'infusion', 'tisane', 'boisson'
    ]
  },
  {
    nom: 'Fruits à Coque',
    ordre: 3,
    couleur: '#795548',
    icon: 'bi-asterisk',
    keywords: [
      'noix', 'noisette', 'amande', 'pistache', 'cacahuete', 'cajou',
      'noix de', 'pecan', 'macadamia'
    ]
  },
  {
    nom: 'Épices et Condiments',
    ordre: 4,
    couleur: '#FF5722',
    icon: 'bi-fire',
    keywords: [
      'vanille', 'epice', 'poivre', 'sel', 'piment', 'curry', 'curcuma',
      'paprika', 'cannelle', 'gingembre', 'muscade', 'safran', 'condiment',
      'vinaigre', 'moutarde', 'sauce', 'huile'
    ]
  },
  {
    nom: 'Cosmétiques et Hygiène',
    ordre: 5,
    couleur: '#E91E63',
    icon: 'bi-droplet',
    keywords: [
      'creme', 'solaire', 'savon', 'shampoing', 'dentifrice', 'deodorant',
      'huile essentielle', 'cosmetique', 'hygiene', 'bebe', 'enfant', 'spf'
    ]
  },
  {
    nom: 'Chocolat et Confiserie',
    ordre: 6,
    couleur: '#6D4C41',
    icon: 'bi-gift',
    keywords: [
      'chocolat', 'palet', 'bonbon', 'confiserie', 'sucre', 'miel',
      'confiture', 'pate a tartiner', 'caramel'
    ]
  },
  {
    nom: 'Desserts et Compotes',
    ordre: 7,
    couleur: '#FFC107',
    icon: 'bi-ice-cream',
    keywords: [
      'dessert', 'compote', 'yaourt', 'creme dessert', 'mousse',
      'gateau', 'biscuit', 'tarte'
    ]
  },
  {
    nom: 'Céréales et Farines',
    ordre: 8,
    couleur: '#FF9800',
    icon: 'bi-wheat',
    keywords: [
      'farine', 'couscous', 'ble', 'epeautre', 'seigle', 'avoine',
      'riz', 'quinoa', 'millet', 'sarrasin', 'cereale', 'pain',
      'pates', 'semoule'
    ]
  },
  {
    nom: 'Produits Laitiers',
    ordre: 10,
    couleur: '#FFFFFF',
    icon: 'bi-egg',
    keywords: [
      'lait', 'fromage', 'beurre', 'creme', 'yaourt', 'yogourt',
      'faisselle', 'ricotta', 'mozzarella', 'emmental'
    ]
  },
  {
    nom: 'Viandes et Poissons',
    ordre: 11,
    couleur: '#F44336',
    icon: 'bi-meat',
    keywords: [
      'viande', 'boeuf', 'porc', 'poulet', 'canard', 'agneau',
      'poisson', 'saumon', 'thon', 'sardine', 'truite', 'merlu',
      'charcuterie', 'jambon', 'saucisse'
    ]
  },
  {
    nom: 'Produits Divers',
    ordre: 99,
    couleur: '#9E9E9E',
    icon: 'bi-box',
    keywords: [] // Catégorie par défaut pour tout ce qui ne match pas
  }
];

/**
 * Détermine la catégorie d'un produit basé sur son nom
 */
function categorizeProduct(productName) {
  if (!productName) {
    return CATEGORIES[CATEGORIES.length - 1]; // Produits Divers
  }

  const nameLower = productName.toLowerCase().trim();

  // Chercher la première catégorie qui matche
  for (const category of CATEGORIES) {
    if (category.keywords.length === 0) continue; // Skip "Produits Divers"

    for (const keyword of category.keywords) {
      if (nameLower.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  // Si aucune catégorie ne matche, retourner "Produits Divers"
  return CATEGORIES[CATEGORIES.length - 1];
}

/**
 * Teste le système de catégorisation sur un échantillon
 */
function testCategorization(products) {
  console.log('🧪 Test de catégorisation automatique\n');

  const stats = {};

  products.forEach((product, index) => {
    const category = categorizeProduct(product);

    if (!stats[category.nom]) {
      stats[category.nom] = 0;
    }
    stats[category.nom]++;

    if (index < 20) {
      console.log(`${index + 1}. "${product}" → ${category.nom}`);
    }
  });

  console.log('\n📊 Statistiques de catégorisation:\n');
  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} produits`);
    });
}

module.exports = {
  CATEGORIES,
  categorizeProduct,
  testCategorization
};

// Si exécuté directement
if (require.main === module) {
  const testProducts = [
    'ail blanc frais',
    'cidre brut',
    'jus de pommes',
    'NOIX Franquette',
    'vanille bourbon madagascar',
    'Creme solaire spf50',
    'palet chocolat noir',
    'Dessert pomme abricot',
    'Farine de ble t55',
    'Lentilles corail',
    'pomme Dalireine',
    'courge shiatsu',
    'radis rose botte'
  ];

  testCategorization(testProducts);
}
