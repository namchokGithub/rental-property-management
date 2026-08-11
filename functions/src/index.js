const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { app } = require("./app");

setGlobalOptions({ region: process.env.FUNCTIONS_REGION || "asia-southeast1" });

exports.api = onRequest(app);
