const { roomsService } = require("../services/rooms.service");
const validator = require("../validators/rooms.validator");
const { sendList, sendSuccess } = require("../utils/response");

async function list(request, response) {
  return sendList(response, await roomsService.list(request.user, request.params.propertyId, {
    status: request.query.status,
    floor: request.query.floor,
  }));
}

async function getById(request, response) { return sendSuccess(response, await roomsService.get(request.user, request.params.propertyId, request.params.id)); }
async function create(request, response) { return sendSuccess(response, await roomsService.create(request.user, request.params.propertyId, validator.create(request.body)), 201); }
async function update(request, response) { return sendSuccess(response, await roomsService.update(request.user, request.params.propertyId, request.params.id, validator.update(request.body))); }
async function remove(request, response) { await roomsService.remove(request.user, request.params.propertyId, request.params.id); return response.status(204).send(); }

module.exports = { list, getById, create, update, remove };
