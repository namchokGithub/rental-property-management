const { Timestamp } = require("firebase-admin/firestore");
const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const { ensurePropertyAccess } = require("./property-access.service");
const repository = require("../repositories/invoices.repository");
const { invoiceNumber, counterId } = require("../utils/invoice-number");
const { defaultDueDate } = require("../utils/billing-calculator");
const toTimestamp = (date) => Timestamp.fromDate(date);
const today = () => new Date();
function displayStatus(invoice) { if (invoice.status === "issued" && invoice.dueDate?.toDate && invoice.dueDate.toDate() < today()) return { ...invoice, status: "overdue" }; return invoice; }
function makeItems(billing) { return [ { type: "rent", name: "ค่าเช่ารายเดือน", amount: billing.rentAmount }, { type: "electricity", name: "ค่าไฟฟ้า", ...billing.electricity }, { type: "water", name: "ค่าน้ำประปา", ...billing.water }, ...billing.otherCharges.map((charge) => ({ type: "other", name: charge.name, amount: charge.amount })) ]; }
function createInvoicesService({ repo = repository, access = ensurePropertyAccess } = {}) {
  async function owned(user, propertyId, id) { access(user, propertyId); const invoice = await repo.findById(id); if (!invoice || invoice.propertyId !== propertyId) throw new AppError(404, ERROR_CODES.INVOICE_NOT_FOUND, "Invoice not found"); return invoice; }
  return {
    async list(user, propertyId, filters) { access(user, propertyId); return (await repo.findAllByProperty(propertyId, {})).map(displayStatus).filter((invoice) => Object.entries(filters).every(([key, value]) => invoice[key] === value)); },
    async get(user, propertyId, id) { return displayStatus(await owned(user, propertyId, id)); },
    async create(user, propertyId, { billingId }) { access(user, propertyId); const id = await repo.db.runTransaction(async (transaction) => {
      const billingReference = repo.references.billingRecords.doc(billingId); const billingSnapshot = await transaction.get(billingReference);
      if (!billingSnapshot.exists || billingSnapshot.data().propertyId !== propertyId) throw new AppError(404, ERROR_CODES.BILLING_NOT_FOUND, "Billing record not found");
      const billing = billingSnapshot.data(); const existing = await transaction.get(repo.invoiceByBillingQuery(propertyId, billingId)); if (!existing.empty) throw new AppError(409, ERROR_CODES.INVOICE_ALREADY_EXISTS, "Invoice already exists for this billing record");
      if (billing.status !== "draft") throw new AppError(409, ERROR_CODES.BILLING_ALREADY_ISSUED, "Billing record has already been issued or is not issuable");
      const counterReference = repo.references.counters.doc(counterId(propertyId, billing.billingMonth)); const counterSnapshot = await transaction.get(counterReference);
      const settingsSnapshot = billing.invoiceNote === undefined ? await transaction.get(repo.references.settings.doc(propertyId)) : null;
      const current = counterSnapshot.exists ? counterSnapshot.data().current : 0; if (!Number.isInteger(current) || current < 0) throw new AppError(500, ERROR_CODES.INVOICE_COUNTER_ERROR, "Invoice counter is invalid");
      const sequence = current + 1; const invoiceReference = repo.references.invoices.doc(); const dueDate = billing.dueDate || Timestamp.fromDate(new Date(`${defaultDueDate(billing.billingMonth)}T00:00:00.000+07:00`)); const note = billing.invoiceNote === undefined ? (settingsSnapshot?.exists ? settingsSnapshot.data().defaultInvoiceNote || "" : "") : billing.invoiceNote;
      transaction.set(counterReference, { propertyId, type: "invoice", period: billing.billingMonth, current: sequence, updatedAt: repo.FieldValue.serverTimestamp(), ...(counterSnapshot.exists ? {} : { createdAt: repo.FieldValue.serverTimestamp() }) });
      transaction.create(invoiceReference, { propertyId, billingId, invoiceNumber: invoiceNumber(billing.billingMonth, sequence), billingMonth: billing.billingMonth, roomId: billing.roomId, tenantId: billing.tenantId || null, roomSnapshot: billing.roomSnapshot, tenantSnapshot: billing.tenantSnapshot || null, items: makeItems(billing), subtotal: billing.subtotal, total: billing.total, note, status: "issued", dueDate, paidAt: null, issuedAt: repo.FieldValue.serverTimestamp(), createdAt: repo.FieldValue.serverTimestamp(), updatedAt: repo.FieldValue.serverTimestamp() });
      transaction.update(billingReference, { status: "issued", invoiceId: invoiceReference.id, invoiceNumber: invoiceNumber(billing.billingMonth, sequence), issuedAt: repo.FieldValue.serverTimestamp(), updatedAt: repo.FieldValue.serverTimestamp() }); return invoiceReference.id;
    }); return repo.findById(id); },
    async markPaid(user, propertyId, id, data) { access(user, propertyId); await repo.db.runTransaction(async (transaction) => { const reference = repo.references.invoices.doc(id); const snapshot = await transaction.get(reference); if (!snapshot.exists || snapshot.data().propertyId !== propertyId) throw new AppError(404, ERROR_CODES.INVOICE_NOT_FOUND, "Invoice not found"); const invoice = snapshot.data(); if (invoice.status === "paid") throw new AppError(409, ERROR_CODES.INVOICE_ALREADY_PAID, "Invoice is already paid"); const paidAt = data.paidAt ? toTimestamp(data.paidAt) : repo.FieldValue.serverTimestamp(); if (data.paidAt && invoice.issuedAt?.toDate && data.paidAt < invoice.issuedAt.toDate()) throw new AppError(400, ERROR_CODES.INVALID_PAYMENT_DATE, "Payment date cannot precede issue date"); const billingReference = repo.references.billingRecords.doc(invoice.billingId); const billingSnapshot = await transaction.get(billingReference); if (!billingSnapshot.exists || billingSnapshot.data().propertyId !== propertyId) throw new AppError(404, ERROR_CODES.BILLING_NOT_FOUND, "Billing record not found"); transaction.update(reference, { status: "paid", paidAt, updatedAt: repo.FieldValue.serverTimestamp() }); transaction.update(billingReference, { status: "paid", paidAt, updatedAt: repo.FieldValue.serverTimestamp() }); }); return repo.findById(id); },
  };
}
module.exports = { invoicesService: createInvoicesService(), createInvoicesService };
