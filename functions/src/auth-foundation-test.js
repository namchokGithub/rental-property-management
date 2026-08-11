const assert = require("node:assert/strict");
const { createRequireAuth } = require("./middleware/auth.middleware");
const { requireRole } = require("./middleware/role.middleware");
const { ensurePropertyAccess } = require("./services/property-access.service");
const { createUsersService } = require("./services/users.service");
const { AppError } = require("./errors/app-error");
const { ERROR_CODES } = require("./errors/error-codes");

function createRequest(authorization) {
  return {
    get(name) {
      return name.toLowerCase() === "authorization" ? authorization : undefined;
    },
  };
}

function invokeMiddleware(middleware, request) {
  return new Promise((resolve) => middleware(request, {}, (error) => resolve(error)));
}

async function testAuthMiddleware() {
  const requireAuth = createRequireAuth({
    verifyIdToken: async (token) => {
      if (token === "valid-token") return { uid: "user-1", email: "user@example.test" };
      throw Object.assign(new Error("invalid"), { code: "auth/argument-error" });
    },
    loadUser: async (auth) => ({ ...auth, displayName: "User", role: "staff", propertyIds: ["property-1"] }),
  });

  const missingTokenError = await invokeMiddleware(requireAuth, createRequest());
  assert.equal(missingTokenError.code, ERROR_CODES.UNAUTHORIZED);
  assert.equal(missingTokenError.statusCode, 401);

  const invalidTokenError = await invokeMiddleware(requireAuth, createRequest("Bearer invalid-token"));
  assert.equal(invalidTokenError.code, ERROR_CODES.INVALID_TOKEN);
  assert.equal(invalidTokenError.statusCode, 401);

  const request = createRequest("Bearer valid-token");
  const validTokenError = await invokeMiddleware(requireAuth, request);
  assert.equal(validTokenError, undefined);
  assert.deepEqual(request.auth, { uid: "user-1", email: "user@example.test" });
  assert.equal(request.user.role, "staff");
}

async function testUserService() {
  const missingProfileService = createUsersService({ findById: async () => null });
  await assert.rejects(
    () => missingProfileService.loadAuthenticatedUser({ uid: "missing", email: null }),
    (error) => error instanceof AppError && error.code === ERROR_CODES.USER_PROFILE_NOT_FOUND
  );

  const disabledUserService = createUsersService({
    findById: async () => ({ isActive: false }),
  });
  await assert.rejects(
    () => disabledUserService.loadAuthenticatedUser({ uid: "disabled", email: null }),
    (error) => error instanceof AppError && error.code === ERROR_CODES.USER_DISABLED
  );

  const activeUserService = createUsersService({
    findById: async () => ({
      email: "profile@example.test",
      displayName: "Administrator",
      role: "admin",
      propertyIds: ["property-1"],
      isActive: true,
    }),
  });
  const user = await activeUserService.loadAuthenticatedUser({ uid: "admin-1", email: "token@example.test" });
  assert.deepEqual(user, {
    uid: "admin-1",
    email: "token@example.test",
    displayName: "Administrator",
    role: "admin",
    propertyIds: ["property-1"],
  });
}

function testRoleAndPropertyAccess() {
  const allowedRequest = { user: { role: "admin" } };
  let allowedNextError;
  requireRole("admin")(allowedRequest, {}, (error) => {
    allowedNextError = error;
  });
  assert.equal(allowedNextError, undefined);

  let forbiddenNextError;
  requireRole("admin")({ user: { role: "staff" } }, {}, (error) => {
    forbiddenNextError = error;
  });
  assert.equal(forbiddenNextError.code, ERROR_CODES.FORBIDDEN);
  assert.equal(forbiddenNextError.statusCode, 403);

  assert.equal(ensurePropertyAccess({ propertyIds: ["property-1"] }, "property-1"), "property-1");
  assert.throws(
    () => ensurePropertyAccess({ propertyIds: ["property-1"] }, "property-2"),
    (error) => error instanceof AppError && error.code === ERROR_CODES.PROPERTY_ACCESS_DENIED
  );
}

Promise.resolve()
  .then(testAuthMiddleware)
  .then(testUserService)
  .then(testRoleAndPropertyAccess)
  .then(() => process.stdout.write("Authentication foundation tests passed.\n"))
  .catch((error) => {
    process.stderr.write(`Authentication foundation tests failed: ${error.message}\n`);
    process.exitCode = 1;
  });
