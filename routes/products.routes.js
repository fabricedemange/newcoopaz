const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configuration du stockage multer pour les images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads/products');
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accepter seulement les images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seulement les images sont acceptées'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

const { db } = require("../config/db-trace-wrapper");
const { requirePermission } = require("../middleware/rbac.middleware");
const { renderAdminView } = require("../utils/view-helpers");
const { getCurrentOrgId } = require("../utils/session-helpers");
const { queryWithUser } = require("../config/db-trace-wrapper");
const csrfProtection = require("../config/csrf");

// ============================================================================
// Liste des produits - Version Vue.js
// ============================================================================
router.get("/vue", requirePermission('products'), (req, res) => {
  renderAdminView(res, "admin_products_list_vue");
});

// ============================================================================
// Liste des produits - Redirection vers Vue+Vite
// ============================================================================
router.get("/", requirePermission('products'), (req, res) => {
  const q = new URLSearchParams(req.query).toString();
  res.redirect("/admin/products/vue" + (q ? "?" + q : ""));
});

// ============================================================================
// API: Recherche de produits (pour ajout au catalogue)
// ============================================================================
router.get("/search", requirePermission('products'), (req, res) => {
  const { category_id, supplier_id, search, catalog_id } = req.query;
  const orgId = getCurrentOrgId(req);

  let sql = `
    SELECT
      p.*,
      c.nom as categorie,
      c.couleur as categorie_couleur,
      s.nom as fournisseur,
      CASE WHEN cp.id IS NOT NULL THEN 1 ELSE 0 END as deja_dans_catalogue,
      (SELECT cp2.prix FROM catalog_products cp2
       WHERE cp2.product_id = p.id
       ORDER BY cp2.created_at DESC LIMIT 1) as dernier_prix
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN catalog_products cp ON (cp.product_id = p.id AND cp.catalog_file_id = ?)
    WHERE p.organization_id = ? AND p.is_active = 1
  `;

  const params = [catalog_id || 0, orgId];

  if (category_id) {
    sql += " AND p.category_id = ?";
    params.push(category_id);
  }

  if (supplier_id) {
    sql += " AND p.supplier_id = ?";
    params.push(supplier_id);
  }

  if (search) {
    sql += " AND (p.nom LIKE ? OR p.description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY p.nom LIMIT 50";

  db.query(sql, params, (err, products) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(products);
  });
});

// ============================================================================
// Formulaire de création (Vue+Vite)
// ============================================================================
router.get("/new", requirePermission('products'), csrfProtection, (req, res) => {
  const orgId = getCurrentOrgId(req);

  db.query("SELECT * FROM categories WHERE organization_id = ? AND is_active = 1 ORDER BY ordre, nom", [orgId], (e1, categories) => {
    db.query("SELECT * FROM suppliers WHERE organization_id = ? AND is_active = 1 ORDER BY nom", [orgId], (e2, suppliers) => {
      const payload = {
        product: null,
        categories: categories || [],
        suppliers: suppliers || [],
        csrfToken: req.csrfToken(),
        APP_VERSION: req.app.locals.APP_VERSION || Date.now(),
      };
      res.render("admin_product_form_vue", payload);
    });
  });
});

// ============================================================================
// Créer un produit
// ============================================================================
router.post("/", requirePermission('products'), csrfProtection, (req, res) => {
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
  const {
    nom,
    description,
    category_id,
    supplier_id,
    reference_fournisseur,
    code_ean,
    conditionnement,
    unite,
    quantite_min,
    prix,
    dlc_jours,
    origine,
    label,
    allergenes,
    is_active
  } = req.body;
  const orgId = getCurrentOrgId(req);

  if (!nom || nom.trim() === "") {
    if (wantsJson) return res.status(400).json({ success: false, error: "Le nom du produit est obligatoire" });
    return res.status(400).send("Le nom du produit est obligatoire");
  }

  if (!category_id) {
    if (wantsJson) return res.status(400).json({ success: false, error: "La catégorie est obligatoire" });
    return res.status(400).send("La catégorie est obligatoire");
  }

  queryWithUser(`
    INSERT INTO products (
      organization_id, nom, description, category_id, supplier_id,
      reference_fournisseur, code_ean, conditionnement, unite, quantite_min,
      prix, dlc_jours, origine, label, allergenes, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    orgId,
    nom.trim(),
    description || null,
    category_id,
    supplier_id || null,
    reference_fournisseur || null,
    code_ean || null,
    conditionnement || null,
    unite || 'Pièce',
    quantite_min || 1,
    prix || 0,
    dlc_jours || null,
    origine || null,
    label || null,
    allergenes || null,
    is_active ? 1 : 0
  ], (err, result) => {
    if (err) {
      if (wantsJson) return res.status(500).json({ success: false, error: "Erreur lors de la création du produit" });
      return res.status(500).send("Erreur lors de la création du produit");
    }
    const redirect = result && result.insertId ? `/admin/products/${result.insertId}` : "/admin/products/vue";
    if (wantsJson) return res.json({ success: true, redirect });
    res.redirect(redirect);
  }, req);
});

// ============================================================================
// Détails d'un produit (Vue+Vite)
// ============================================================================
router.get("/:id", requirePermission('products'), (req, res) => {
  const orgId = getCurrentOrgId(req);
  const productId = req.params.id;

  db.query(`
    SELECT
      p.*,
      c.nom as categorie,
      c.couleur as categorie_couleur,
      s.nom as fournisseur,
      s.id as fournisseur_id
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = ? AND p.organization_id = ?
  `, [productId, orgId], (err, products) => {
    if (err || !products || products.length === 0) {
      return res.status(404).send("Produit non trouvé");
    }

    const product = products[0];

    db.query(`
      SELECT
        cf.id,
        cf.originalname,
        cf.date_livraison,
        cp.prix,
        cp.unite,
        COUNT(DISTINCT pa.panier_id) as nb_paniers
      FROM catalog_products cp
      INNER JOIN catalog_files cf ON cp.catalog_file_id = cf.id
      LEFT JOIN panier_articles pa ON pa.catalog_product_id = cp.id
      WHERE cp.product_id = ?
      GROUP BY cf.id, cp.prix, cp.unite
      ORDER BY cf.date_livraison DESC
    `, [productId], (err2, catalogues) => {
      const payload = {
        product,
        catalogues: catalogues || [],
        APP_VERSION: req.app.locals.APP_VERSION || Date.now(),
      };
      res.render("admin_product_detail_vue", payload);
    });
  });
});

// ============================================================================
// Formulaire d'édition (Vue+Vite)
// ============================================================================
router.get("/:id/edit", requirePermission('products'), csrfProtection, (req, res) => {
  const orgId = getCurrentOrgId(req);
  const productId = req.params.id;

  db.query(
    "SELECT * FROM products WHERE id = ? AND organization_id = ?",
    [productId, orgId],
    (err, products) => {
      if (err || !products || products.length === 0) {
        return res.status(404).send("Produit non trouvé");
      }

      const product = products[0];

      db.query("SELECT * FROM categories WHERE organization_id = ? AND is_active = 1 ORDER BY ordre, nom", [orgId], (e1, categories) => {
        db.query("SELECT * FROM suppliers WHERE organization_id = ? AND is_active = 1 ORDER BY nom", [orgId], (e2, suppliers) => {
          const payload = {
            product,
            categories: categories || [],
            suppliers: suppliers || [],
            csrfToken: req.csrfToken(),
            APP_VERSION: req.app.locals.APP_VERSION || Date.now(),
          };
          res.render("admin_product_form_vue", payload);
        });
      });
    }
  );
});

// ============================================================================
// Modifier un produit
// Note: Using upload.any() instead of upload.single('image') to avoid
// "Unexpected field" errors with certain browsers/form configurations
// ============================================================================
router.post("/:id", requirePermission('products'), (req, res, next) => {
  console.log('🔍 AVANT MULTER - Content-Type:', req.headers['content-type']);
  next();
}, upload.any(), (req, res, next) => {
  console.log('🔍 APRÈS MULTER - Content-Type:', req.headers['content-type']);
  next();
}, (req, res) => {
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
  const orgId = getCurrentOrgId(req);
  const productId = req.params.id;
  const {
    nom,
    description,
    category_id,
    supplier_id,
    reference_fournisseur,
    code_ean,
    conditionnement,
    unite,
    quantite_min,
    prix,
    dlc_jours,
    origine,
    label,
    allergenes,
    is_active
  } = req.body;

  if (!nom || nom.trim() === "") {
    if (wantsJson) return res.status(400).json({ success: false, error: "Le nom du produit est obligatoire" });
    return res.status(400).send("Le nom du produit est obligatoire");
  }

  if (!category_id) {
    if (wantsJson) return res.status(400).json({ success: false, error: "La catégorie est obligatoire" });
    return res.status(400).send("La catégorie est obligatoire");
  }

  let imageUrl = null;
  const imageFile = req.files && req.files.find(f => f.fieldname === 'image');
  if (imageFile) {
    imageUrl = '/uploads/products/' + imageFile.filename;
  }

  let updateQuery = `
    UPDATE products SET
      nom = ?,
      description = ?,
      category_id = ?,
      supplier_id = ?,
      reference_fournisseur = ?,
      code_ean = ?,
      conditionnement = ?,
      unite = ?,
      quantite_min = ?,
      prix = ?,
      dlc_jours = ?,
      origine = ?,
      label = ?,
      allergenes = ?,
      is_active = ?`;

  const params = [
    nom.trim(),
    description || null,
    category_id,
    supplier_id || null,
    reference_fournisseur || null,
    code_ean || null,
    conditionnement || null,
    unite || 'Pièce',
    quantite_min || 1,
    prix || 0,
    dlc_jours || null,
    origine || null,
    label || null,
    allergenes || null,
    is_active ? 1 : 0
  ];

  if (imageUrl) {
    updateQuery += `, image_url = ?`;
    params.push(imageUrl);
  }

  updateQuery += `, updated_at = NOW() WHERE id = ? AND organization_id = ?`;
  params.push(productId, orgId);

  queryWithUser(updateQuery, params, (err) => {
    if (err) {
      console.error('Erreur UPDATE product:', err.message);
      if (wantsJson) return res.status(500).json({ success: false, error: "Erreur lors de la modification du produit" });
      return res.status(500).send("Erreur lors de la modification du produit");
    }
    if (wantsJson) return res.json({ success: true, redirect: `/admin/products/${productId}` });
    res.redirect(`/admin/products/${productId}`);
  }, req);
});

// ============================================================================
// Désactiver un produit (soft delete)
// ============================================================================
router.post("/:id/delete", requirePermission('products'), csrfProtection, (req, res) => {
  const orgId = getCurrentOrgId(req);
  const productId = req.params.id;

  queryWithUser(
    "UPDATE products SET is_active = 0 WHERE id = ? AND organization_id = ?",
    [productId, orgId],
    (err) => {
      if (err) {
        return res.status(500).send("Erreur lors de la désactivation du produit");
      }
      res.redirect("/admin/products");
    },
    req
  );
});

// ============================================================================
// Multer error handler - must be after all routes
// ============================================================================
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer error CODE:', error.code);
    console.error('❌ Multer error FIELD:', error.field);
    console.error('❌ Multer error MESSAGE:', error.message);
    console.error('❌ Full error:', error);
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).send(`Champ inattendu: '${error.field}'. Attendu: 'image'`);
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('Fichier trop volumineux (max 5MB)');
    }
    return res.status(400).send('Erreur d\'upload: ' + error.message);
  }
  next(error);
});

module.exports = router;
