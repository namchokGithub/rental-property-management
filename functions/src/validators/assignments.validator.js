const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function invalid(message = "Invalid assignment data") {
  throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, message);
}

function date(value) {
  if (typeof value !== "string" || !DATE.test(value)) invalid();
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) invalid();
  return value;
}

function id(value) {
  if (typeof value !== "string" || !value.trim()) invalid();
  return value.trim();
}

function create(body) {
  if (!body || typeof body !== "object") invalid();
  return { roomId: id(body.roomId), tenantId: id(body.tenantId), startDate: date(body.startDate) };
}

function end(body = {}) {
  if (!body || typeof body !== "object") invalid();
  if (body.endDate === undefined) return {};
  return { endDate: date(body.endDate) };
}

function filters(query = {}) {
  const data = {};
  if (query.status !== undefined) {
    if (query.status !== "active" && query.status !== "ended") invalid("Invalid assignment filters");
    data.status = query.status;
  }
  for (const key of ["roomId", "tenantId"]) if (query[key] !== undefined) data[key] = id(query[key]);
  return data;
}

module.exports = { create, end, filters };
