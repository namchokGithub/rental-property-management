const cors = require("cors");

function getAllowedOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function createCorsMiddleware() {
  const allowedOrigins = getAllowedOrigins();

  return cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  });
}

module.exports = { createCorsMiddleware };
