const projectId = process.env.GCLOUD_PROJECT || "demo-rental-property-management";
const region = process.env.FUNCTIONS_REGION || "asia-southeast1";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const email = process.env.DEV_USER_EMAIL || "admin@example.test";
const password = process.env.DEV_USER_PASSWORD;

if (!authEmulatorHost || !password) {
  throw new Error("Set FIREBASE_AUTH_EMULATOR_HOST and DEV_USER_PASSWORD before verifying resource APIs.");
}

const authUrl = `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`;
const apiBaseUrl = `http://127.0.0.1:5001/${projectId}/${region}/api/api/v1`;

async function signIn() {
  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok || !body.idToken) throw new Error("Could not obtain an Auth Emulator ID token. Seed the development user first.");
  return body.idToken;
}

async function request(token, path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...options.headers },
  });
  return { response, body: response.status === 204 ? null : await response.json() };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyResourceApis() {
  const token = await signIn();
  const createdProperty = await request(token, "/properties", {
    method: "POST",
    body: JSON.stringify({ name: "API Verification Property", address: "Emulator only" }),
  });
  assert(createdProperty.response.status === 201 && createdProperty.body.success, "Property creation failed");
  const propertyId = createdProperty.body.data.id;

  const updatedProperty = await request(token, `/properties/${propertyId}`, {
    method: "PATCH",
    body: JSON.stringify({ phone: "02-000-0000" }),
  });
  assert(updatedProperty.response.status === 200 && updatedProperty.body.data.phone === "02-000-0000", "Property update failed");

  const defaultSettings = await request(token, `/properties/${propertyId}/settings`);
  assert(defaultSettings.response.status === 200 && defaultSettings.body.data.defaultElectricityRate === 0, "Settings defaults failed");
  const savedSettings = await request(token, `/properties/${propertyId}/settings`, {
    method: "PUT",
    body: JSON.stringify({ defaultElectricityRate: 8, defaultWaterRate: 18, defaultInvoiceNote: "Emulator test" }),
  });
  assert(savedSettings.response.status === 200 && savedSettings.body.data.defaultWaterRate === 18, "Settings upsert failed");

  const createdCharge = await request(token, `/properties/${propertyId}/other-charges`, {
    method: "POST",
    body: JSON.stringify({ nameTh: "ค่าทดสอบ API", nameEn: "API Test Charge", defaultAmount: 50, isActive: true }),
  });
  assert(createdCharge.response.status === 201 && createdCharge.body.success, "Other charge creation failed");
  const chargeId = createdCharge.body.data.id;

  const duplicateCharge = await request(token, `/properties/${propertyId}/other-charges`, {
    method: "POST",
    body: JSON.stringify({ nameTh: " ค่าทดสอบ  API ", defaultAmount: 50, isActive: true }),
  });
  assert(duplicateCharge.response.status === 409 && duplicateCharge.body.error.code === "OTHER_CHARGE_ALREADY_EXISTS", "Duplicate check failed");

  const disabledCharge = await request(token, `/properties/${propertyId}/other-charges/${chargeId}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: false }),
  });
  assert(disabledCharge.response.status === 200 && disabledCharge.body.data.isActive === false, "Other charge update failed");
  const removedCharge = await request(token, `/properties/${propertyId}/other-charges/${chargeId}`, { method: "DELETE" });
  assert(removedCharge.response.status === 204, "Other charge deletion failed");

  process.stdout.write("Resource API Emulator verification passed.\n");
}

verifyResourceApis().catch((error) => {
  process.stderr.write(`Resource API Emulator verification failed: ${error.message}\n`);
  process.exitCode = 1;
});
