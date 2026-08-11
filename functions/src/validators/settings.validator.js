const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");

function validateSettingsUpdate(body) {
  if (!body || typeof body !== "object") {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid property settings data");
  }

  const { defaultElectricityRate, defaultWaterRate, defaultInvoiceNote } = body;
  if (
    typeof defaultElectricityRate !== "number" ||
    !Number.isFinite(defaultElectricityRate) ||
    defaultElectricityRate < 0 ||
    typeof defaultWaterRate !== "number" ||
    !Number.isFinite(defaultWaterRate) ||
    defaultWaterRate < 0 ||
    typeof defaultInvoiceNote !== "string"
  ) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid property settings data");
  }

  return { defaultElectricityRate, defaultWaterRate, defaultInvoiceNote: defaultInvoiceNote.trim() };
}

module.exports = { validateSettingsUpdate };
