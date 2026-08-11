const { Router } = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { sendSuccess } = require("../utils/response");

const router = Router();

router.get("/me", requireAuth, (request, response) => {
  const { uid, email, displayName, role, propertyIds } = request.user;
  return sendSuccess(response, { id: uid, email, displayName, role, propertyIds });
});

module.exports = { authRouter: router };
