const cors = require("cors");

function getAllowedOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function createCorsMiddleware() {
  const allowedOrigins = getAllowedOrigins();
  // K_SERVICE (Cloud Run) is set by a real 2nd-gen deployment, but the Functions Emulator also sets it
  // to mimic that environment — FUNCTIONS_EMULATOR is the flag that actually distinguishes the two.
  // Plain local `node` runs (smoke/unit tests) have neither set.
  const isRealDeployment = Boolean(process.env.K_SERVICE) && process.env.FUNCTIONS_EMULATOR !== "true";

  if (allowedOrigins.length === 0 && isRealDeployment) {
    throw new Error("CORS_ALLOWED_ORIGINS must be set to a comma-separated origin list in a real deployment");
  }

  return cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  });
}

module.exports = { createCorsMiddleware };
