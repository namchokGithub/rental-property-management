const { Router } = require("express");
const controller = require("../controllers/assignments.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = Router();
router.get("/:propertyId/assignments", requireAuth, controller.list);
router.get("/:propertyId/assignments/:id", requireAuth, controller.getById);
router.post("/:propertyId/assignments", requireAuth, requireRole("admin"), controller.create);
router.post("/:propertyId/assignments/:id/end", requireAuth, requireRole("admin"), controller.end);

module.exports = { assignmentsRouter: router };
