const projectId = process.env.GCLOUD_PROJECT || "demo-rental-property-management";
const region = process.env.FUNCTIONS_REGION || "asia-southeast1";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const email = process.env.DEV_USER_EMAIL || "admin@example.test";
const password = process.env.DEV_USER_PASSWORD;

if (!authEmulatorHost || !password) throw new Error("Set FIREBASE_AUTH_EMULATOR_HOST and DEV_USER_PASSWORD before verifying billing APIs.");

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
async function patch(token, path, body) { return request(token, path, { method: "PATCH", body: JSON.stringify(body) }); }

async function verifyBilling() {
  const token = await signIn();
  const property = await post(token, "/properties", { name: "Billing verification property" });
  assert(property.response.status === 201, "Property creation failed");
  const propertyId = property.body.data.id;
  const path = `/properties/${propertyId}`;

  const settings = await request(token, `${path}/settings`, { method: "PUT", body: JSON.stringify({ defaultElectricityRate: 7, defaultWaterRate: 18, defaultInvoiceNote: "Pay by due date" }) });
  assert(settings.response.status === 200, "Settings upsert failed");

  const charge = await post(token, `${path}/other-charges`, { nameTh: "ค่าขยะ", defaultAmount: 50, isActive: true });
  assert(charge.response.status === 201, "Other charge creation failed");
  const chargeId = charge.body.data.id;

  const [room, room2, room3, room4, vacantRoom] = await Promise.all([
    post(token, `${path}/rooms`, { roomNumber: "B-101", monthlyRent: 5000 }),
    post(token, `${path}/rooms`, { roomNumber: "B-102", monthlyRent: 5000 }),
    post(token, `${path}/rooms`, { roomNumber: "B-103", monthlyRent: 5000 }),
    post(token, `${path}/rooms`, { roomNumber: "B-104", monthlyRent: 5000 }),
    post(token, `${path}/rooms`, { roomNumber: "B-105", monthlyRent: 5000 }),
  ]);
  for (const item of [room, room2, room3, room4, vacantRoom]) assert(item.response.status === 201, "Room setup failed");

  const tenant = await post(token, `${path}/tenants`, { fullName: "Billing Tenant" });
  assert(tenant.response.status === 201, "Tenant creation failed");
  const assignment = await post(token, `${path}/assignments`, { roomId: room.body.data.id, tenantId: tenant.body.data.id, startDate: "2026-08-01" });
  assert(assignment.response.status === 201, "Assignment creation failed");

  // Rounding: 137 kWh * 7 = 959.00 exactly, but with a rate that forces a rounding decision (7.333...) usage stays raw and only the amount rounds.
  const billing = await post(token, `${path}/billing`, {
    roomId: room.body.data.id,
    billingMonth: "2026-08",
    electricity: { previousMeter: 1000, currentMeter: 1137 },
    water: { previousMeter: 200, currentMeter: 210 },
    otherCharges: [{ masterId: chargeId }],
    customCharges: [{ name: "ค่าซ่อมกุญแจ", amount: 150 }],
  });
  assert(billing.response.status === 201, `Billing creation failed: ${JSON.stringify(billing.body)}`);
  const record = billing.body.data;
  assert(record.electricity.usage === 137 && record.water.usage === 10, "Meter usage calculation failed");
  assert(record.electricity.amount === 959, "Electricity amount calculation failed");
  assert(record.otherCharges.length === 2, "Other charges + custom charge were not both applied");
  assert(record.subtotal === 5000 + 959 + 180 && record.total === record.subtotal + 50 + 150, "Subtotal/total calculation failed");
  assert(record.tenantSnapshot?.fullName === "Billing Tenant" && record.roomSnapshot?.roomNumber === "B-101", "Snapshot fields missing");
  assert(record.status === "draft", "New billing record was not a draft");

  const decreasingMeter = await post(token, `${path}/billing`, { roomId: room2.body.data.id, billingMonth: "2026-08", electricity: { previousMeter: 1000, currentMeter: 900 }, water: { previousMeter: 0, currentMeter: 10 } });
  assert(decreasingMeter.response.status === 400 && decreasingMeter.body.error.code === "INVALID_ELECTRICITY_METER_READING", "Decreasing meter reading was accepted");

  const duplicateMasterCharge = await post(token, `${path}/billing`, { roomId: room2.body.data.id, billingMonth: "2026-08", electricity: { previousMeter: 0, currentMeter: 10 }, water: { previousMeter: 0, currentMeter: 10 }, otherCharges: [{ masterId: chargeId }, { masterId: chargeId }] });
  assert(duplicateMasterCharge.response.status === 400 && duplicateMasterCharge.body.error.code === "DUPLICATE_BILLING_CHARGE", "Duplicate master charge on one bill was accepted");

  const sequentialDuplicate = await post(token, `${path}/billing`, { roomId: room.body.data.id, billingMonth: "2026-08", electricity: { previousMeter: 1137, currentMeter: 1150 }, water: { previousMeter: 210, currentMeter: 215 } });
  assert(sequentialDuplicate.response.status === 409 && sequentialDuplicate.body.error.code === "BILLING_ALREADY_EXISTS", "Sequential duplicate billing (same room+month) was not rejected");

  // Concurrency: two simultaneous creates for the same room+month must yield exactly one success.
  // Regresses the fixed race — billingRecords used a random doc ID and a duplicate-check query alone,
  // so two concurrent requests could both pass the empty-check and both commit (see ADR 0004).
  const racing = await Promise.all([
    post(token, `${path}/billing`, { roomId: room3.body.data.id, billingMonth: "2026-09", electricity: { previousMeter: 0, currentMeter: 50 }, water: { previousMeter: 0, currentMeter: 5 } }),
    post(token, `${path}/billing`, { roomId: room3.body.data.id, billingMonth: "2026-09", electricity: { previousMeter: 0, currentMeter: 50 }, water: { previousMeter: 0, currentMeter: 5 } }),
  ]);
  const raceSuccesses = racing.filter((item) => item.response.status === 201);
  const raceConflicts = racing.filter((item) => item.response.status === 409 && item.body.error.code === "BILLING_ALREADY_EXISTS");
  assert(raceSuccesses.length === 1 && raceConflicts.length === 1, `Concurrent billing creates for the same room+month did not produce exactly one success — got statuses ${racing.map((item) => item.response.status).join(",")}`);

  const edited = await patch(token, `${path}/billing/${record.id}`, { rentAmount: 5200 });
  assert(edited.response.status === 200 && edited.body.data.rentAmount === 5200 && edited.body.data.roomSnapshot.roomNumber === "B-101", "Draft edit did not recalculate while preserving snapshots");

  // Snapshot integrity: changing the room and the charge master after billing creation must not change the already-created bill.
  await patch(token, `${path}/rooms/${room.body.data.id}`, { roomNumber: "B-101-RENAMED", monthlyRent: 9999 });
  await request(token, `${path}/other-charges/${chargeId}`, { method: "PATCH", body: JSON.stringify({ nameTh: "ค่าขยะ (แก้ไข)", defaultAmount: 999 }) });
  const afterMasterEdit = await request(token, `${path}/billing/${record.id}`);
  assert(afterMasterEdit.body.data.roomSnapshot.roomNumber === "B-101", "Billing roomSnapshot changed after editing the room master");
  assert(afterMasterEdit.body.data.otherCharges.find((c) => c.masterId === chargeId).amount === 50, "Billing charge snapshot changed after editing the charge master's default amount");

  const draftDelete = await post(token, `${path}/billing`, { roomId: room4.body.data.id, billingMonth: "2026-08", electricity: { previousMeter: 0, currentMeter: 10 }, water: { previousMeter: 0, currentMeter: 5 } });
  const deleted = await request(token, `${path}/billing/${draftDelete.body.data.id}`, { method: "DELETE" });
  assert(deleted.response.status === 204, "Draft billing deletion failed");
  const afterDelete = await request(token, `${path}/billing/${draftDelete.body.data.id}`);
  assert(afterDelete.response.status === 404 && afterDelete.body.error.code === "BILLING_NOT_FOUND", "Deleted billing record was still readable");

  const vacantBilling = await post(token, `${path}/billing`, { roomId: vacantRoom.body.data.id, billingMonth: "2026-08", electricity: { previousMeter: 0, currentMeter: 5 }, water: { previousMeter: 0, currentMeter: 2 } });
  assert(vacantBilling.response.status === 201 && vacantBilling.body.data.tenantId === null && vacantBilling.body.data.tenantSnapshot === null, "Vacant room billing was not created with null tenant fields");

  // Property isolation: a billing ID from property A must 404 (not leak) under a second, unrelated property.
  const otherProperty = await post(token, "/properties", { name: "Billing verification property 2" });
  const crossProperty = await request(token, `/properties/${otherProperty.body.data.id}/billing/${record.id}`);
  assert(crossProperty.response.status === 404 && crossProperty.body.error.code === "BILLING_NOT_FOUND", "Cross-property billing access was not rejected as not-found");

  process.stdout.write("Billing API Emulator verification passed.\n");
}

verifyBilling().catch((error) => {
  process.stderr.write(`Billing API Emulator verification failed: ${error.message}\n`);
  process.exitCode = 1;
});
