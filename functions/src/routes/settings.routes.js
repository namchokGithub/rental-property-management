const { Router } = require("express");
const settingsController = require("../controllers/settings.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = Router();

router.get("/:propertyId/settings", requireAuth, settingsController.get);
router.put("/:propertyId/settings", requireAuth, requireRole("admin"), settingsController.upsert);

module.exports = { settingsRouter: router };
