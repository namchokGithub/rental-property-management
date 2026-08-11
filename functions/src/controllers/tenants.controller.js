const { tenantsService } = require("../services/tenants.service");
const validator = require("../validators/tenants.validator");
const { sendList, sendSuccess } = require("../utils/response");

async function list(request, response) { return sendList(response, await tenantsService.list(request.user, request.params.propertyId, { status: request.query.status })); }
async function getById(request, response) { return sendSuccess(response, await tenantsService.get(request.user, request.params.propertyId, request.params.id)); }
async function create(request, response) { return sendSuccess(response, await tenantsService.create(request.user, request.params.propertyId, validator.create(request.body)), 201); }
async function update(request, response) { return sendSuccess(response, await tenantsService.update(request.user, request.params.propertyId, request.params.id, validator.update(request.body))); }
async function remove(request, response) { await tenantsService.remove(request.user, request.params.propertyId, request.params.id); return response.status(204).send(); }

module.exports = { list, getById, create, update, remove };
