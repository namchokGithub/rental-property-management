const { settingsService } = require("../services/settings.service");
const { validateSettingsUpdate } = require("../validators/settings.validator");
const { sendSuccess } = require("../utils/response");

async function get(request, response) {
  return sendSuccess(response, await settingsService.getForUser(request.user, request.params.propertyId));
}

async function upsert(request, response) {
  return sendSuccess(
    response,
    await settingsService.upsertForUser(request.user, request.params.propertyId, validateSettingsUpdate(request.body))
  );
}

module.exports = { get, upsert };
