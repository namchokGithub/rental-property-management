const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const { ensurePropertyAccess } = require("./property-access.service");
const propertiesRepository = require("../repositories/properties.repository");

function toPropertyResponse(property) {
  const { id, name, address, phone } = property;
  return { id, name, ...(address !== undefined ? { address } : {}), ...(phone !== undefined ? { phone } : {}) };
}

function createPropertiesService({ repository = propertiesRepository, access = ensurePropertyAccess } = {}) {
  async function getOwnedProperty(user, propertyId) {
    access(user, propertyId);
    const property = await repository.findById(propertyId);
    if (!property) throw new AppError(404, ERROR_CODES.PROPERTY_NOT_FOUND, "Property not found");
    return property;
  }

  return {
    async listForUser(user) {
      return (await repository.findByIds(user.propertyIds)).map(toPropertyResponse);
    },

    async getForUser(user, propertyId) {
      return toPropertyResponse(await getOwnedProperty(user, propertyId));
    },

    async createForUser(user, data) {
      return toPropertyResponse(await repository.createForOwner(user.uid, data));
    },

    async updateForUser(user, propertyId, data) {
      await getOwnedProperty(user, propertyId);
      return toPropertyResponse(await repository.update(propertyId, data));
    },
  };
}

const propertiesService = createPropertiesService();

module.exports = { createPropertiesService, propertiesService };
