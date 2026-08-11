const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");

function validationError() {
  return new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid other charge data");
}

function validateNameTh(value) {
  if (typeof value !== "string") throw validationError();
  const name = value.trim();
  if (name.length === 0 || name.length > 200) throw validationError();
  return name;
}

function validateOptionalNameEn(value) {
  if (typeof value !== "string" || value.trim().length > 200) throw validationError();
  return value.trim();
}

function validateAmount(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw validationError();
  return value;
}

function validateOtherChargeCreate(body) {
  if (!body || typeof body !== "object") throw validationError();
  const data = {
    nameTh: validateNameTh(body.nameTh),
    defaultAmount: validateAmount(body.defaultAmount),
    isActive: body.isActive === undefined ? true : body.isActive,
  };
  if (typeof data.isActive !== "boolean") throw validationError();
  if (body.nameEn !== undefined) data.nameEn = validateOptionalNameEn(body.nameEn);
  return data;
}

function validateOtherChargeUpdate(body) {
  if (!body || typeof body !== "object") throw validationError();
  const data = {};
  if (body.nameTh !== undefined) data.nameTh = validateNameTh(body.nameTh);
  if (body.nameEn !== undefined) data.nameEn = validateOptionalNameEn(body.nameEn);
  if (body.defaultAmount !== undefined) data.defaultAmount = validateAmount(body.defaultAmount);
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") throw validationError();
    data.isActive = body.isActive;
  }
  if (Object.keys(data).length === 0) throw validationError();
  return data;
}

function parseIsActive(value) {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw validationError();
}

module.exports = { validateOtherChargeCreate, validateOtherChargeUpdate, parseIsActive };
