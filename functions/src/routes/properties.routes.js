const { Router } = require("express");
const propertiesController = require("../controllers/properties.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = Router();

router.get("/", requireAuth, propertiesController.list);
router.get("/:id", requireAuth, propertiesController.getById);
router.post("/", requireAuth, requireRole("admin"), propertiesController.create);
router.patch("/:id", requireAuth, requireRole("admin"), propertiesController.update);

module.exports = { propertiesRouter: router };
