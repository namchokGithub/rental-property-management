const { billingService } = require("../services/billing.service");
const validator = require("../validators/billing.validator");
const { sendList, sendSuccess } = require("../utils/response");
async function list(request, response) { return sendList(response, await billingService.list(request.user, request.params.propertyId, validator.filters(request.query))); }
async function getById(request, response) { return sendSuccess(response, await billingService.get(request.user, request.params.propertyId, request.params.id)); }
async function create(request, response) { return sendSuccess(response, await billingService.create(request.user, request.params.propertyId, validator.create(request.body)), 201); }
async function update(request, response) { return sendSuccess(response, await billingService.update(request.user, request.params.propertyId, request.params.id, validator.update(request.body))); }
async function remove(request, response) { await billingService.remove(request.user, request.params.propertyId, request.params.id); return response.status(204).send(); }
module.exports = { list, getById, create, update, remove };
