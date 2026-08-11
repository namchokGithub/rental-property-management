const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const { findById } = require("../repositories/users.repository");

const SUPPORTED_ROLES = new Set(["admin", "staff"]);

function createUsersService({ findById: findUserById }) {
  return {
    async loadAuthenticatedUser(authContext) {
      const profile = await findUserById(authContext.uid);
      if (!profile) {
        throw new AppError(403, ERROR_CODES.USER_PROFILE_NOT_FOUND, "User profile is not configured");
      }

      if (profile.isActive !== true) {
        throw new AppError(403, ERROR_CODES.USER_DISABLED, "User account is disabled");
      }

      if (!SUPPORTED_ROLES.has(profile.role) || !Array.isArray(profile.propertyIds)) {
        throw new AppError(403, ERROR_CODES.FORBIDDEN, "You do not have permission to perform this action");
      }

      return {
        uid: authContext.uid,
        email: authContext.email || profile.email || null,
        displayName: typeof profile.displayName === "string" ? profile.displayName : "",
        role: profile.role,
        propertyIds: profile.propertyIds.filter((propertyId) => typeof propertyId === "string"),
      };
    },
  };
}

const { loadAuthenticatedUser } = createUsersService({ findById });

module.exports = { SUPPORTED_ROLES, createUsersService, loadAuthenticatedUser };
