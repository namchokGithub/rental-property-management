const { propertiesService } = require("../services/properties.service");
const { validatePropertyCreate, validatePropertyUpdate } = require("../validators/properties.validator");
const { sendList, sendSuccess } = require("../utils/response");

async function list(request, response) {
  return sendList(response, await propertiesService.listForUser(request.user));
}

async function getById(request, response) {
  return sendSuccess(response, await propertiesService.getForUser(request.user, request.params.id));
}

async function create(request, response) {
  return sendSuccess(response, await propertiesService.createForUser(request.user, validatePropertyCreate(request.body)), 201);
}

async function update(request, response) {
  return sendSuccess(
    response,
    await propertiesService.updateForUser(request.user, request.params.id, validatePropertyUpdate(request.body))
  );
}

module.exports = { list, getById, create, update };
