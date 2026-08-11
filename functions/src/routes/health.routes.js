const { Router } = require("express");
const { sendSuccess } = require("../utils/response");

const router = Router();

router.get("/health", (request, response) => sendSuccess(response, { status: "ok" }));

module.exports = { healthRouter: router };
