const { logger } = require("firebase-functions");
const { auth } = require("../config/firebase");
const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const { loadAuthenticatedUser } = require("../services/users.service");

function createRequireAuth({ verifyIdToken, loadUser }) {
  return async function requireAuth(request, response, next) {
    const authorization = request.get("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();

    if (!token) {
      return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, "Authentication required"));
    }

    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
    } catch (error) {
      logger.warn("Firebase ID token verification failed", {
        errorCode: typeof error?.code === "string" ? error.code : "unknown",
      });
      return next(new AppError(401, ERROR_CODES.INVALID_TOKEN, "Authentication token is invalid"));
    }

    request.auth = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
    };

    try {
      request.user = await loadUser(request.auth);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

const requireAuth = createRequireAuth({
  verifyIdToken: (token) => auth.verifyIdToken(token),
  loadUser: loadAuthenticatedUser,
});

module.exports = { createRequireAuth, requireAuth };
