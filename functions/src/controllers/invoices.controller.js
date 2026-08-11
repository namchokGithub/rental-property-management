const { invoicesService } = require("../services/invoices.service");
const validator = require("../validators/invoices.validator");
const { sendList, sendSuccess } = require("../utils/response");
async function list(request, response) { return sendList(response, await invoicesService.list(request.user, request.params.propertyId, validator.filters(request.query))); }
async function getById(request, response) { return sendSuccess(response, await invoicesService.get(request.user, request.params.propertyId, request.params.id)); }
async function create(request, response) { return sendSuccess(response, await invoicesService.create(request.user, request.params.propertyId, validator.create(request.body)), 201); }
async function markPaid(request, response) { return sendSuccess(response, await invoicesService.markPaid(request.user, request.params.propertyId, request.params.id, validator.markPaid(request.body))); }
module.exports = { list, getById, create, markPaid };
