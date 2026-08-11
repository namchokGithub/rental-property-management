const { Timestamp } = require("firebase-admin/firestore");
const { randomUUID } = require("node:crypto");
const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const { ensurePropertyAccess } = require("./property-access.service");
const repository = require("../repositories/billing.repository");
const { calculateBilling, defaultDueDate } = require("../utils/billing-calculator");
const BANGKOK_OFFSET = "+07:00";
const timestamp = (value) => Timestamp.fromDate(new Date(`${value}T00:00:00.000${BANGKOK_OFFSET}`));

function createBillingService({ repo = repository, access = ensurePropertyAccess } = {}) {
  async function owned(user, propertyId, id) { access(user, propertyId); const billing = await repo.findById(id); if (!billing || billing.propertyId !== propertyId) throw new AppError(404, ERROR_CODES.BILLING_NOT_FOUND, "Billing record not found"); return billing; }
  async function resolveCharges(transaction, propertyId, requestedMasters, customCharges) {
    const seen = new Set();
    for (const charge of requestedMasters) { if (seen.has(charge.masterId)) throw new AppError(400, ERROR_CODES.DUPLICATE_BILLING_CHARGE, "A master charge can appear only once"); seen.add(charge.masterId); }
    const masters = await Promise.all(requestedMasters.map((charge) => transaction.get(repo.references.chargeMasters.doc(charge.masterId))));
    return [
      ...masters.map((snapshot, index) => {
        const master = snapshot.exists ? snapshot.data() : null;
        if (!master || master.propertyId !== propertyId) throw new AppError(404, ERROR_CODES.BILLING_CHARGE_NOT_FOUND, "Other charge master not found");
        if (!master.isActive) throw new AppError(409, ERROR_CODES.BILLING_CHARGE_INACTIVE, "Other charge master is inactive");
        return { id: randomUUID(), masterId: snapshot.id, name: master.nameTh, amount: requestedMasters[index].amount === undefined ? master.defaultAmount : requestedMasters[index].amount };
      }),
      ...customCharges.map((charge) => ({ id: randomUUID(), masterId: null, name: charge.name, amount: charge.amount })),
    ];
  }
  async function draftData(transaction, propertyId, roomId, input, existing = null) {
    const roomSnapshot = await transaction.get(repo.references.rooms.doc(roomId));
    if (!roomSnapshot.exists || roomSnapshot.data().propertyId !== propertyId) throw new AppError(404, ERROR_CODES.BILLING_ROOM_NOT_FOUND, "Room not found");
    const room = roomSnapshot.data();
    const settingsSnapshot = await transaction.get(repo.references.settings.doc(propertyId));
    const propertySettings = settingsSnapshot.exists ? settingsSnapshot.data() : { defaultElectricityRate: 0, defaultWaterRate: 0, defaultInvoiceNote: "" };
    const activeAssignment = existing ? null : await transaction.get(repo.activeAssignmentQuery(propertyId, roomId));
    const assignment = activeAssignment?.empty ? null : activeAssignment?.docs[0].data();
    const tenantSnapshot = assignment ? await transaction.get(repo.references.tenants.doc(assignment.tenantId)) : null;
    const tenant = tenantSnapshot?.exists && tenantSnapshot.data().propertyId === propertyId ? tenantSnapshot.data() : null;
    const charges = await resolveCharges(transaction, propertyId, input.otherCharges, input.customCharges);
    const rentAmount = input.rentAmount === undefined ? (existing ? existing.rentAmount : room.monthlyRent) : input.rentAmount;
    const electricityInput = input.electricity || { previousMeter: existing.electricity.previousMeter, currentMeter: existing.electricity.currentMeter };
    const waterInput = input.water || { previousMeter: existing.water.previousMeter, currentMeter: existing.water.currentMeter };
    const electricityRate = existing ? existing.electricity.rate : (room.electricityRate ?? propertySettings.defaultElectricityRate);
    const waterRate = existing ? existing.water.rate : (room.waterRate ?? propertySettings.defaultWaterRate);
    const calculated = calculateBilling({ rentAmount, electricityInput, electricityRate, waterInput, waterRate, otherCharges: charges });
    return { roomId, tenantId: existing ? existing.tenantId || null : (tenantSnapshot ? (tenant ? tenantSnapshot.id : null) : null), roomSnapshot: existing?.roomSnapshot || { roomNumber: room.roomNumber, monthlyRent: room.monthlyRent }, tenantSnapshot: existing?.tenantSnapshot || (tenant ? { fullName: tenant.fullName } : null), rentAmount, electricity: calculated.electricity, water: calculated.water, otherCharges: charges, subtotal: calculated.subtotal, total: calculated.total, dueDate: timestamp(input.dueDate || (existing?.dueDate?.toDate ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(existing.dueDate.toDate()) : defaultDueDate(input.billingMonth || existing.billingMonth))), invoiceNote: existing?.invoiceNote ?? propertySettings.defaultInvoiceNote };
  }
  return {
    async list(user, propertyId, filters) { access(user, propertyId); return repo.findAllByProperty(propertyId, filters); },
    async get(user, propertyId, id) { return owned(user, propertyId, id); },
    async create(user, propertyId, input) {
      access(user, propertyId);
      const id = await repo.db.runTransaction(async (transaction) => {
        const existing = await transaction.get(repo.billingByRoomAndMonthQuery(propertyId, input.roomId, input.billingMonth));
        if (!existing.empty) throw new AppError(409, ERROR_CODES.BILLING_ALREADY_EXISTS, "Billing already exists for this room and month");
        const data = await draftData(transaction, propertyId, input.roomId, input);
        const reference = repo.references.billingRecords.doc(repo.billingDocId(input.roomId, input.billingMonth));
        transaction.create(reference, { propertyId, billingMonth: input.billingMonth, status: "draft", ...data, createdAt: repo.FieldValue.serverTimestamp(), updatedAt: repo.FieldValue.serverTimestamp() });
        return reference.id;
      });
      return repo.findById(id);
    },
    async update(user, propertyId, id, input) {
      access(user, propertyId);
      await repo.db.runTransaction(async (transaction) => {
        const reference = repo.references.billingRecords.doc(id); const snapshot = await transaction.get(reference);
        if (!snapshot.exists || snapshot.data().propertyId !== propertyId) throw new AppError(404, ERROR_CODES.BILLING_NOT_FOUND, "Billing record not found");
        const existing = { id, ...snapshot.data() };
        if (existing.status !== "draft") throw new AppError(409, ERROR_CODES.BILLING_NOT_EDITABLE, "Only draft billing records can be edited");
        const hasCharges = input.otherCharges !== undefined || input.customCharges !== undefined;
        const data = await draftData(transaction, propertyId, existing.roomId, { ...input, billingMonth: existing.billingMonth, otherCharges: hasCharges ? input.otherCharges : [], customCharges: hasCharges ? input.customCharges : [] }, existing);
        if (!hasCharges) data.otherCharges = existing.otherCharges;
        if (!hasCharges) Object.assign(data, calculateBilling({ rentAmount: data.rentAmount, electricityInput: { previousMeter: data.electricity.previousMeter, currentMeter: data.electricity.currentMeter }, electricityRate: data.electricity.rate, waterInput: { previousMeter: data.water.previousMeter, currentMeter: data.water.currentMeter }, waterRate: data.water.rate, otherCharges: data.otherCharges }));
        transaction.update(reference, { ...data, updatedAt: repo.FieldValue.serverTimestamp() });
      });
      return repo.findById(id);
    },
    async remove(user, propertyId, id) { const billing = await owned(user, propertyId, id); if (billing.status !== "draft") throw new AppError(409, ERROR_CODES.BILLING_NOT_DELETABLE, "Only draft billing records can be deleted"); await repo.references.billingRecords.doc(id).delete(); },
  };
}
module.exports = { billingService: createBillingService(), createBillingService };
