const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const { ensurePropertyAccess } = require("./property-access.service");
const propertiesRepository = require("../repositories/properties.repository");
const settingsRepository = require("../repositories/settings.repository");

const DEFAULT_SETTINGS = Object.freeze({
  defaultElectricityRate: 0,
  defaultWaterRate: 0,
  defaultInvoiceNote: "",
});

function toSettingsResponse(settings) {
  const { propertyId, defaultElectricityRate, defaultWaterRate, defaultInvoiceNote } = settings;
  return { propertyId, defaultElectricityRate, defaultWaterRate, defaultInvoiceNote };
}

function createSettingsService({
  settings = settingsRepository,
  properties = propertiesRepository,
  access = ensurePropertyAccess,
} = {}) {
  async function ensureExistingProperty(user, propertyId) {
    access(user, propertyId);
    if (!(await properties.findById(propertyId))) {
      throw new AppError(404, ERROR_CODES.PROPERTY_NOT_FOUND, "Property not found");
    }
  }

  return {
    async getForUser(user, propertyId) {
      await ensureExistingProperty(user, propertyId);
      const settingsDocument = await settings.findByPropertyId(propertyId);
      return toSettingsResponse(settingsDocument || { propertyId, ...DEFAULT_SETTINGS });
    },

    async upsertForUser(user, propertyId, data) {
      await ensureExistingProperty(user, propertyId);
      return toSettingsResponse(await settings.upsert(propertyId, data));
    },
  };
}

const settingsService = createSettingsService();

module.exports = { DEFAULT_SETTINGS, createSettingsService, settingsService };
