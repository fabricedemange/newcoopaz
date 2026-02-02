const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/rbac.middleware");

// Route organizations (convertie en Vue.js - anciennes routes commentées ci-dessous)
router.get("/", requirePermission("organizations"), (req, res) => {
  res.render("admin_organizations_vue", {
    user: req.session.user,
    role: req.session.role,
  });
});

// Anciennes routes organizations (commentées - API maintenant dans api.admin.organizations.routes.js)
// POST /add, POST /edit/:id, POST /delete/:id

module.exports = router;
