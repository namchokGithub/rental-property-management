const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");

function validationError() {
  return new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid property data");
}

function optionalText(value) {
  if (typeof value !== "string") throw validationError();
  return value.trim();
}

function validatePropertyCreate(body) {
  if (!body || typeof body !== "object" || typeof body.name !== "string") throw validationError();
  const name = body.name.trim();
  if (name.length === 0 || name.length > 200) throw validationError();

  const data = { name };
  if (body.address !== undefined) data.address = optionalText(body.address);
  if (body.phone !== undefined) data.phone = optionalText(body.phone);
  return data;
}

function validatePropertyUpdate(body) {
  if (!body || typeof body !== "object") throw validationError();
  const data = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string") throw validationError();
    const name = body.name.trim();
    if (name.length === 0 || name.length > 200) throw validationError();
    data.name = name;
  }
  if (body.address !== undefined) data.address = optionalText(body.address);
  if (body.phone !== undefined) data.phone = optionalText(body.phone);
  if (Object.keys(data).length === 0) throw validationError();
  return data;
}

module.exports = { validatePropertyCreate, validatePropertyUpdate };
