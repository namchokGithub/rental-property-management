const { otherChargesService } = require("../services/other-charges.service");
const { parseIsActive, validateOtherChargeCreate, validateOtherChargeUpdate } = require("../validators/other-charges.validator");
const { sendList, sendSuccess } = require("../utils/response");

async function list(request, response) {
  const charges = await otherChargesService.listForUser(request.user, request.params.propertyId, {
    isActive: parseIsActive(request.query.isActive),
  });
  return sendList(response, charges);
}

async function getById(request, response) {
  return sendSuccess(
    response,
    await otherChargesService.getForUser(request.user, request.params.propertyId, request.params.id)
  );
}

async function create(request, response) {
  return sendSuccess(
    response,
    await otherChargesService.createForUser(request.user, request.params.propertyId, validateOtherChargeCreate(request.body)),
    201
  );
}

async function update(request, response) {
  return sendSuccess(
    response,
    await otherChargesService.updateForUser(
      request.user,
      request.params.propertyId,
      request.params.id,
      validateOtherChargeUpdate(request.body)
    )
  );
}

async function remove(request, response) {
  await otherChargesService.deleteForUser(request.user, request.params.propertyId, request.params.id);
  return response.status(204).send();
}

module.exports = { list, getById, create, update, remove };
