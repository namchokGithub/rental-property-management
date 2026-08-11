const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const MONTH = /^(\d{4})-(\d{2})$/;
function fail(code = ERROR_CODES.VALIDATION_ERROR) { throw new AppError(400, code, "Invalid invoice data"); }
function text(value) { if (typeof value !== "string" || !value.trim()) fail(); return value.trim(); }
function billingMonth(value) { if (typeof value !== "string" || !MONTH.test(value)) fail(ERROR_CODES.INVALID_BILLING_MONTH); const [year, month] = value.split("-").map(Number); if (month < 1 || month > 12 || year < 1) fail(ERROR_CODES.INVALID_BILLING_MONTH); return value; }
function create(body) { if (!body || typeof body !== "object") fail(); return { billingId: text(body.billingId) }; }
function markPaid(body = {}) { if (!body || typeof body !== "object") fail(); if (body.paidAt === undefined) return {}; if (typeof body.paidAt !== "string" || Number.isNaN(Date.parse(body.paidAt))) fail(ERROR_CODES.INVALID_PAYMENT_DATE); return { paidAt: new Date(body.paidAt) }; }
function filters(query = {}) { const data = {}; if (query.billingMonth !== undefined) data.billingMonth = billingMonth(query.billingMonth); for (const key of ["roomId", "tenantId"]) if (query[key] !== undefined) data[key] = text(query[key]); if (query.status !== undefined) { if (!["issued", "paid", "overdue"].includes(query.status)) fail(ERROR_CODES.INVALID_INVOICE_STATUS); data.status = query.status; } return data; }
module.exports = { create, markPaid, filters };
