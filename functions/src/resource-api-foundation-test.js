const assert = require("node:assert/strict");
const { AppError } = require("./errors/app-error");
const { ERROR_CODES } = require("./errors/error-codes");
const { createOtherChargesService } = require("./services/other-charges.service");
const { createSettingsService, DEFAULT_SETTINGS } = require("./services/settings.service");
const { validateOtherChargeCreate, parseIsActive } = require("./validators/other-charges.validator");
const { validatePropertyCreate } = require("./validators/properties.validator");
const { validateSettingsUpdate } = require("./validators/settings.validator");

const user = { uid: "admin-1", propertyIds: ["property-1"] };
const access = (candidate, propertyId) => {
  if (!candidate.propertyIds.includes(propertyId)) throw new AppError(403, ERROR_CODES.PROPERTY_ACCESS_DENIED, "Denied");
};

async function testValidation() {
  assert.deepEqual(validatePropertyCreate({ name: "  Sunrise Apartments  ", phone: " 02-123 " }), {
    name: "Sunrise Apartments",
    phone: "02-123",
  });
  assert.throws(() => validateSettingsUpdate({ defaultElectricityRate: -1, defaultWaterRate: 0, defaultInvoiceNote: "" }));
  assert.deepEqual(validateSettingsUpdate({ defaultElectricityRate: 8, defaultWaterRate: 18, defaultInvoiceNote: " Note " }), {
    defaultElectricityRate: 8,
    defaultWaterRate: 18,
    defaultInvoiceNote: "Note",
  });
  assert.equal(parseIsActive("true"), true);
  assert.equal(parseIsActive("false"), false);
  assert.throws(() => parseIsActive("yes"));
}

async function testSettingsDefaults() {
  const service = createSettingsService({
    access,
    properties: { findById: async () => ({ id: "property-1" }) },
    settings: { findByPropertyId: async () => null },
  });
  assert.deepEqual(await service.getForUser(user, "property-1"), { propertyId: "property-1", ...DEFAULT_SETTINGS });
}

async function testOtherChargeBusinessRules() {
  const charges = [{ id: "charge-1", propertyId: "property-1", nameTh: "ค่าขยะ", defaultAmount: 50, isActive: true }];
  const service = createOtherChargesService({
    access,
    repository: {
      findAllByProperty: async () => charges,
      findById: async (id) => charges.find((charge) => charge.id === id) || null,
      create: async (data) => ({ id: "charge-2", ...data }),
      update: async (id, data) => ({ id, propertyId: "property-1", nameTh: "ค่าขยะ", defaultAmount: 50, isActive: true, ...data }),
      remove: async () => undefined,
    },
  });

  await assert.rejects(
    () => service.createForUser(user, "property-1", validateOtherChargeCreate({ nameTh: " ค่าขยะ ", defaultAmount: 50 })),
    (error) => error.code === ERROR_CODES.OTHER_CHARGE_ALREADY_EXISTS
  );
  assert.throws(
    () => access(user, "property-2"),
    (error) => error.code === ERROR_CODES.PROPERTY_ACCESS_DENIED
  );
}

Promise.resolve()
  .then(testValidation)
  .then(testSettingsDefaults)
  .then(testOtherChargeBusinessRules)
  .then(() => process.stdout.write("Property, settings, and other-charge foundation tests passed.\n"))
  .catch((error) => {
    process.stderr.write(`Resource API foundation tests failed: ${error.message}\n`);
    process.exitCode = 1;
  });
