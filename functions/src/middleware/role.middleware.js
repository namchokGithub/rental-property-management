const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");

function requireRole(...allowedRoles) {
  if (allowedRoles.length === 0) {
    throw new Error("requireRole must be configured with at least one role");
  }

  return function roleMiddleware(request, response, next) {
    if (!request.user) {
      return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, "Authentication required"));
    }

    if (!allowedRoles.includes(request.user.role)) {
      return next(new AppError(403, ERROR_CODES.FORBIDDEN, "You do not have permission to perform this action"));
    }

    return next();
  };
}

module.exports = { requireRole };
