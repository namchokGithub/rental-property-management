const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");

function ensurePropertyAccess(user, propertyId) {
  if (typeof propertyId !== "string" || propertyId.trim() === "") {
    throw new AppError(400, ERROR_CODES.PROPERTY_ID_REQUIRED, "Property ID is required");
  }

  if (!Array.isArray(user?.propertyIds) || !user.propertyIds.includes(propertyId)) {
    throw new AppError(403, ERROR_CODES.PROPERTY_ACCESS_DENIED, "You do not have access to this property");
  }

  return propertyId;
}

module.exports = { ensurePropertyAccess };
