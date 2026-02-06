const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requireAnyPermission } = require("../middleware/rbac.middleware");
const { logger } = require("../config/logger");
const {
  getMaintenanceSettings,
  setAppSetting,
  setAppSettingText,
} = require("../services/app-settings.service");

/** GET /api/admin/maintenance/settings - Super admin ou admin */
router.get("/settings", requireAnyPermission(["organizations.view_all", "admin"], { json: true }), (req, res) => {
  getMaintenanceSettings((err, settings) => {
    if (err) {
      return res.status(500).json({ success: false, error: "Erreur lecture réglages" });
    }
    res.json({
      success: true,
      maintenanceEnabled: !!settings?.enabled,
      maintenanceMessage: settings?.message || "",
    });
  });
});

/** PATCH /api/admin/maintenance/settings - Super admin ou admin */
router.patch("/settings", requireAnyPermission(["organizations.view_all", "admin"], { json: true }), (req, res) => {
  const { maintenanceEnabled, maintenanceMessage } = req.body || {};

  const updates = [];
  if (typeof maintenanceEnabled === "boolean") {
    updates.push((cb) => setAppSetting("maintenance_enabled", maintenanceEnabled, cb));
  }
  if (typeof maintenanceMessage === "string") {
    updates.push((cb) => setAppSettingText("maintenance_message", maintenanceMessage, cb));
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, error: "Aucune valeur à mettre à jour" });
  }

  let done = 0;
  const onDone = (err) => {
    if (res.headersSent) return;
    if (err) {
      return res.status(500).json({ success: false, error: "Erreur mise à jour réglages" });
    }
    done += 1;
    if (done === updates.length) {
      const username = req.session?.username || "";
      const userId = req.session?.userId ?? "";
      const usernameVal = username + (userId !== "" ? "(" + userId + ")" : "");
      const parts = [];
      if (typeof maintenanceEnabled === "boolean") parts.push(`enabled=${maintenanceEnabled ? 1 : 0}`);
      if (typeof maintenanceMessage === "string") parts.push(`message=${maintenanceMessage.slice(0, 50)}${maintenanceMessage.length > 50 ? "…" : ""}`);
      db.query(
        "INSERT INTO trace (username, query, params) VALUES (?, ?, ?)",
        [usernameVal, "UPDATE app_settings (maintenance) : " + parts.join(", "), parts.join(" // ")],
        (traceErr) => { if (traceErr) logger.error("Erreur trace maintenance", { error: traceErr?.message }); }
      );

      getMaintenanceSettings((e, s) => {
        if (e) return res.status(500).json({ success: false, error: "Erreur lecture réglages" });
        res.json({
          success: true,
          maintenanceEnabled: !!s?.enabled,
          maintenanceMessage: s?.message || "",
        });
      });
    }
  };
  updates.forEach((fn) => fn(onDone));
});

module.exports = router;
