const { Router } = require("express");
const otherChargesController = require("../controllers/other-charges.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = Router();

router.get("/:propertyId/other-charges", requireAuth, otherChargesController.list);
router.get("/:propertyId/other-charges/:id", requireAuth, otherChargesController.getById);
router.post("/:propertyId/other-charges", requireAuth, requireRole("admin"), otherChargesController.create);
router.patch("/:propertyId/other-charges/:id", requireAuth, requireRole("admin"), otherChargesController.update);
router.delete("/:propertyId/other-charges/:id", requireAuth, requireRole("admin"), otherChargesController.remove);

module.exports = { otherChargesRouter: router };
