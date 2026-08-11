const { logger } = require("firebase-functions");
const { AppError } = require("../errors/app-error");
const { sendError } = require("../utils/response");

function notFoundMiddleware(request, response, next) {
  next(new AppError(404, "NOT_FOUND", "Resource not found"));
}

function errorMiddleware(error, request, response, next) {
  if (response.headersSent) return next(error);

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error("API application error", {
        code: error.code,
        method: request.method,
        path: request.originalUrl,
      });
    }
    return sendError(response, error.statusCode, error.code, error.message, error.details);
  }

  logger.error("Unexpected API error", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    method: request.method,
    path: request.originalUrl,
  });
  return sendError(response, 500, "INTERNAL_ERROR", "Something went wrong");
}

module.exports = { notFoundMiddleware, errorMiddleware };
