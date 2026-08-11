const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const MONTH = /^(\d{4})-(\d{2})$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function fail(code = ERROR_CODES.VALIDATION_ERROR, message = "Invalid billing data") { throw new AppError(400, code, message); }
function text(value) { if (typeof value !== "string" || !value.trim()) fail(); return value.trim(); }
function nonNegative(value) { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(); return value; }
function calendar(value, pattern, code = ERROR_CODES.VALIDATION_ERROR) {
  if (typeof value !== "string" || !pattern.test(value)) fail(code);
  const parts = value.split("-").map(Number); const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] || 1));
  if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 || (parts[2] && date.getUTCDate() !== parts[2])) fail(code);
  return value;
}
function billingMonth(value) { return calendar(value, MONTH, ERROR_CODES.INVALID_BILLING_MONTH); }
function dueDate(value) { return calendar(value, DATE); }
function reading(value) {
  if (!value || typeof value !== "object") fail();
  return { previousMeter: nonNegative(value.previousMeter), currentMeter: nonNegative(value.currentMeter) };
}
function masterCharge(value) { if (!value || typeof value !== "object") fail(); const result = { masterId: text(value.masterId) }; if (value.amount !== undefined) result.amount = nonNegative(value.amount); return result; }
function customCharge(value) { if (!value || typeof value !== "object") fail(); return { name: text(value.name), amount: nonNegative(value.amount) }; }
function charges(body) {
  const otherCharges = body.otherCharges === undefined ? [] : body.otherCharges;
  const customCharges = body.customCharges === undefined ? [] : body.customCharges;
  if (!Array.isArray(otherCharges) || !Array.isArray(customCharges)) fail();
  return { otherCharges: otherCharges.map(masterCharge), customCharges: customCharges.map(customCharge) };
}
function create(body) {
  if (!body || typeof body !== "object") fail();
  return { roomId: text(body.roomId), billingMonth: billingMonth(body.billingMonth), electricity: reading(body.electricity), water: reading(body.water), ...charges(body), ...(body.rentAmount === undefined ? {} : { rentAmount: nonNegative(body.rentAmount) }), ...(body.dueDate === undefined ? {} : { dueDate: dueDate(body.dueDate) }) };
}
function update(body) {
  if (!body || typeof body !== "object") fail(); const data = {};
  if (body.electricity !== undefined) data.electricity = reading(body.electricity);
  if (body.water !== undefined) data.water = reading(body.water);
  if (body.rentAmount !== undefined) data.rentAmount = nonNegative(body.rentAmount);
  if (body.dueDate !== undefined) data.dueDate = dueDate(body.dueDate);
  if (body.otherCharges !== undefined || body.customCharges !== undefined) Object.assign(data, charges(body));
  if (!Object.keys(data).length) fail(); return data;
}
function filters(query = {}) { const data = {}; if (query.billingMonth !== undefined) data.billingMonth = billingMonth(query.billingMonth); for (const key of ["roomId", "tenantId"]) if (query[key] !== undefined) data[key] = text(query[key]); if (query.status !== undefined) { if (!["draft", "issued", "paid", "overdue"].includes(query.status)) fail(); data.status = query.status; } return data; }
module.exports = { create, update, filters };
