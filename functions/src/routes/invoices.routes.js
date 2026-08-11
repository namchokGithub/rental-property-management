const { Router } = require("express"); const controller = require("../controllers/invoices.controller"); const { requireAuth } = require("../middleware/auth.middleware"); const { requireRole } = require("../middleware/role.middleware");
const router = Router();
router.get("/:propertyId/invoices", requireAuth, controller.list);
router.get("/:propertyId/invoices/:id", requireAuth, controller.getById);
router.post("/:propertyId/invoices", requireAuth, requireRole("admin"), controller.create);
router.post("/:propertyId/invoices/:id/mark-paid", requireAuth, requireRole("admin"), controller.markPaid);
module.exports = { invoicesRouter: router };
