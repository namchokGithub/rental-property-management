const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const { ensurePropertyAccess } = require("./property-access.service");
const otherChargesRepository = require("../repositories/other-charges.repository");

function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");
}

function toOtherChargeResponse(charge) {
  const { id, propertyId, nameTh, nameEn, defaultAmount, isActive } = charge;
  return {
    id,
    propertyId,
    nameTh,
    ...(nameEn !== undefined ? { nameEn } : {}),
    defaultAmount,
    isActive,
  };
}

function createOtherChargesService({ repository = otherChargesRepository, access = ensurePropertyAccess } = {}) {
  async function getOwnedCharge(user, propertyId, id) {
    access(user, propertyId);
    const charge = await repository.findById(id);
    if (!charge || charge.propertyId !== propertyId) {
      throw new AppError(404, ERROR_CODES.OTHER_CHARGE_NOT_FOUND, "Other charge not found");
    }
    return charge;
  }

  async function ensureNoActiveDuplicate(propertyId, nameTh, excludeId) {
    const charges = await repository.findAllByProperty(propertyId);
    const duplicate = charges.find(
      (charge) => charge.id !== excludeId && charge.isActive && normalizeName(charge.nameTh) === normalizeName(nameTh)
    );
    if (duplicate) {
      throw new AppError(409, ERROR_CODES.OTHER_CHARGE_ALREADY_EXISTS, "An active other charge with this Thai name already exists");
    }
  }

  return {
    async listForUser(user, propertyId, options) {
      access(user, propertyId);
      return (await repository.findAllByProperty(propertyId, options)).map(toOtherChargeResponse);
    },

    async getForUser(user, propertyId, id) {
      return toOtherChargeResponse(await getOwnedCharge(user, propertyId, id));
    },

    async createForUser(user, propertyId, data) {
      access(user, propertyId);
      if (data.isActive) await ensureNoActiveDuplicate(propertyId, data.nameTh);
      return toOtherChargeResponse(await repository.create({ propertyId, ...data }));
    },

    async updateForUser(user, propertyId, id, data) {
      const existing = await getOwnedCharge(user, propertyId, id);
      const next = { ...existing, ...data };
      if (next.isActive) await ensureNoActiveDuplicate(propertyId, next.nameTh, id);
      return toOtherChargeResponse(await repository.update(id, data));
    },

    async deleteForUser(user, propertyId, id) {
      await getOwnedCharge(user, propertyId, id);
      await repository.remove(id);
    },
  };
}

const otherChargesService = createOtherChargesService();

module.exports = { createOtherChargesService, otherChargesService };
