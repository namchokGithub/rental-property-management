const { assignmentsService } = require("../services/assignments.service");
const validator = require("../validators/assignments.validator");
const { sendList, sendSuccess } = require("../utils/response");

async function list(request, response) {
  return sendList(response, await assignmentsService.list(request.user, request.params.propertyId, validator.filters({
    status: request.query.status,
    roomId: request.query.roomId,
    tenantId: request.query.tenantId,
  })));
}

async function getById(request, response) { return sendSuccess(response, await assignmentsService.get(request.user, request.params.propertyId, request.params.id)); }
async function create(request, response) { return sendSuccess(response, await assignmentsService.create(request.user, request.params.propertyId, validator.create(request.body)), 201); }
async function end(request, response) { return sendSuccess(response, await assignmentsService.end(request.user, request.params.propertyId, request.params.id, validator.end(request.body))); }

module.exports = { list, getById, create, end };
