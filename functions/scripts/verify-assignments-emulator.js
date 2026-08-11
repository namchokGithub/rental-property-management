const projectId = process.env.GCLOUD_PROJECT || "demo-rental-property-management";
const region = process.env.FUNCTIONS_REGION || "asia-southeast1";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const email = process.env.DEV_USER_EMAIL || "admin@example.test";
const password = process.env.DEV_USER_PASSWORD;

if (!authEmulatorHost || !password) throw new Error("Set FIREBASE_AUTH_EMULATOR_HOST and DEV_USER_PASSWORD before verifying assignment APIs.");

const authUrl = `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`;
const apiBaseUrl = `http://127.0.0.1:5001/${projectId}/${region}/api/api/v1`;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function signIn() {
  const response = await fetch(authUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const body = await response.json();
  if (!response.ok || !body.idToken) throw new Error("Could not obtain an Auth Emulator ID token. Seed the development user first.");
  return body.idToken;
}

async function request(token, path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...options.headers } });
  return { response, body: response.status === 204 ? null : await response.json() };
}

async function post(token, path, body) { return request(token, path, { method: "POST", body: JSON.stringify(body) }); }

async function verifyAssignments() {
  const token = await signIn();
  const property = await post(token, "/properties", { name: "Assignment verification property" });
  assert(property.response.status === 201, "Property creation failed");
  const propertyId = property.body.data.id;
  const propertyPath = `/properties/${propertyId}`;
  const [room, roomTwo, maintenance, tenant, tenantTwo, inactiveTenant] = await Promise.all([
    post(token, `${propertyPath}/rooms`, { roomNumber: "A-101", monthlyRent: 5000 }),
    post(token, `${propertyPath}/rooms`, { roomNumber: "A-102", monthlyRent: 5000 }),
    post(token, `${propertyPath}/rooms`, { roomNumber: "M-101", monthlyRent: 5000, status: "maintenance" }),
    post(token, `${propertyPath}/tenants`, { fullName: "Assignment Tenant" }),
    post(token, `${propertyPath}/tenants`, { fullName: "Concurrent Tenant" }),
    post(token, `${propertyPath}/tenants`, { fullName: "Inactive Tenant", status: "inactive" }),
  ]);
  for (const item of [room, roomTwo, maintenance, tenant, tenantTwo, inactiveTenant]) assert(item.response.status === 201, "Room or tenant setup failed");

  const competing = await Promise.all([
    post(token, `${propertyPath}/assignments`, { roomId: room.body.data.id, tenantId: tenant.body.data.id, startDate: "2026-08-01" }),
    post(token, `${propertyPath}/assignments`, { roomId: room.body.data.id, tenantId: tenantTwo.body.data.id, startDate: "2026-08-01" }),
  ]);
  const successful = competing.filter((item) => item.response.status === 201);
  const conflicts = competing.filter((item) => item.response.status === 409 && item.body.error.code === "ROOM_ALREADY_OCCUPIED");
  assert(successful.length === 1 && conflicts.length === 1, "Concurrent room assignments did not produce exactly one create and one ROOM_ALREADY_OCCUPIED conflict");
  const assignment = successful[0].body.data;

  const occupiedRoom = await request(token, `${propertyPath}/rooms/${room.body.data.id}`);
  assert(occupiedRoom.body.data.status === "occupied", "Successful assignment did not occupy room");
  const assignments = await request(token, `${propertyPath}/assignments?status=active&roomId=${room.body.data.id}`);
  assert(assignments.response.status === 200 && assignments.body.meta.total === 1, "Active assignment filter failed");
  const blockedRoomDelete = await request(token, `${propertyPath}/rooms/${room.body.data.id}`, { method: "DELETE" });
  const blockedTenantDelete = await request(token, `${propertyPath}/tenants/${assignment.tenantId}`, { method: "DELETE" });
  assert(blockedRoomDelete.response.status === 409 && blockedRoomDelete.body.error.code === "ROOM_HAS_ACTIVE_ASSIGNMENT", "Active room deletion was not blocked");
  assert(blockedTenantDelete.response.status === 409 && blockedTenantDelete.body.error.code === "TENANT_HAS_ACTIVE_ASSIGNMENT", "Active tenant deletion was not blocked");

  const invalidEnd = await post(token, `${propertyPath}/assignments/${assignment.id}/end`, { endDate: "2026-07-31" });
  assert(invalidEnd.response.status === 400 && invalidEnd.body.error.code === "INVALID_ASSIGNMENT_DATE", "Invalid end date was accepted");
  const ended = await post(token, `${propertyPath}/assignments/${assignment.id}/end`, { endDate: "2026-08-31" });
  assert(ended.response.status === 200 && ended.body.data.status === "ended", "Active assignment did not end");
  const availableRoom = await request(token, `${propertyPath}/rooms/${room.body.data.id}`);
  assert(availableRoom.body.data.status === "available", "Ended assignment did not release room");
  const repeatEnd = await post(token, `${propertyPath}/assignments/${assignment.id}/end`, {});
  assert(repeatEnd.response.status === 409 && repeatEnd.body.error.code === "ASSIGNMENT_ALREADY_ENDED", "Ending an ended assignment did not conflict");
  const historicalRoomDelete = await request(token, `${propertyPath}/rooms/${room.body.data.id}`, { method: "DELETE" });
  assert(historicalRoomDelete.response.status === 409 && historicalRoomDelete.body.error.code === "ROOM_HAS_ASSIGNMENT_HISTORY", "Historical room deletion was not blocked");

  const maintenanceAssignment = await post(token, `${propertyPath}/assignments`, { roomId: maintenance.body.data.id, tenantId: tenantTwo.body.data.id, startDate: "2026-08-01" });
  const inactiveTenantAssignment = await post(token, `${propertyPath}/assignments`, { roomId: roomTwo.body.data.id, tenantId: inactiveTenant.body.data.id, startDate: "2026-08-01" });
  assert(maintenanceAssignment.response.status === 409 && maintenanceAssignment.body.error.code === "ROOM_NOT_AVAILABLE", "Maintenance room was assignable");
  assert(inactiveTenantAssignment.response.status === 409 && inactiveTenantAssignment.body.error.code === "TENANT_NOT_ACTIVE", "Inactive tenant was assignable");
  process.stdout.write("Assignment API Emulator verification passed.\n");
}

verifyAssignments().catch((error) => {
  process.stderr.write(`Assignment API Emulator verification failed: ${error.message}\n`);
  process.exitCode = 1;
});
