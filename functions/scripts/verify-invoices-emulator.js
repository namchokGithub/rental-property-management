const projectId = process.env.GCLOUD_PROJECT || "demo-rental-property-management";
const region = process.env.FUNCTIONS_REGION || "asia-southeast1";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const email = process.env.DEV_USER_EMAIL || "admin@example.test";
const password = process.env.DEV_USER_PASSWORD;

if (!authEmulatorHost || !password) throw new Error("Set FIREBASE_AUTH_EMULATOR_HOST and DEV_USER_PASSWORD before verifying invoice APIs.");

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
const meters = { electricity: { previousMeter: 0, currentMeter: 20 }, water: { previousMeter: 0, currentMeter: 5 } };

async function verifyInvoices() {
  const token = await signIn();
  const property = await post(token, "/properties", { name: "Invoice verification property" });
  assert(property.response.status === 201, "Property creation failed");
  const propertyId = property.body.data.id;
  const path = `/properties/${propertyId}`;
  await request(token, `${path}/settings`, { method: "PUT", body: JSON.stringify({ defaultElectricityRate: 7, defaultWaterRate: 18, defaultInvoiceNote: "Pay by due date" }) });

  const [roomA, roomB, roomC, roomD, roomE] = await Promise.all(["I-101", "I-102", "I-103", "I-104", "I-105"].map((roomNumber) => post(token, `${path}/rooms`, { roomNumber, monthlyRent: 5000 })));
  for (const item of [roomA, roomB, roomC, roomD, roomE]) assert(item.response.status === 201, "Room setup failed");
  const tenant = await post(token, `${path}/tenants`, { fullName: "Invoice Tenant" });
  const assignment = await post(token, `${path}/assignments`, { roomId: roomA.body.data.id, tenantId: tenant.body.data.id, startDate: "2026-08-01" });
  assert(assignment.response.status === 201, "Assignment creation failed");

  const billingA = await post(token, `${path}/billing`, { roomId: roomA.body.data.id, billingMonth: "2026-08", ...meters });
  assert(billingA.response.status === 201, "Billing draft creation (room A) failed");

  const invoiceA = await post(token, `${path}/invoices`, { billingId: billingA.body.data.id });
  assert(invoiceA.response.status === 201, `Invoice creation failed: ${JSON.stringify(invoiceA.body)}`);
  assert(/^INV-2026-08-\d{3}$/.test(invoiceA.body.data.invoiceNumber), `Invoice number format invalid: ${invoiceA.body.data.invoiceNumber}`);
  assert(invoiceA.body.data.status === "issued" && invoiceA.body.data.tenantSnapshot?.fullName === "Invoice Tenant", "Issued invoice missing expected fields");
  const billingAfterIssue = await request(token, `${path}/billing/${billingA.body.data.id}`);
  assert(billingAfterIssue.body.data.status === "issued" && billingAfterIssue.body.data.invoiceNumber === invoiceA.body.data.invoiceNumber, "Billing record was not synchronized to issued");

  const sequentialDuplicateInvoice = await post(token, `${path}/invoices`, { billingId: billingA.body.data.id });
  assert(sequentialDuplicateInvoice.response.status === 409 && sequentialDuplicateInvoice.body.error.code === "INVOICE_ALREADY_EXISTS", "Sequential duplicate invoice was not rejected");

  // Concurrency: two simultaneous invoice creations for the SAME billing record must yield exactly one success.
  // Both writers update the same billingRecords document, so Firestore serializes them even though the
  // duplicate-invoice query alone would not (see ADR 0004 for the analogous billing-creation race).
  const billingB = await post(token, `${path}/billing`, { roomId: roomB.body.data.id, billingMonth: "2026-08", ...meters });
  const sameBillingRace = await Promise.all([
    post(token, `${path}/invoices`, { billingId: billingB.body.data.id }),
    post(token, `${path}/invoices`, { billingId: billingB.body.data.id }),
  ]);
  const sameBillingSuccesses = sameBillingRace.filter((item) => item.response.status === 201);
  const sameBillingConflicts = sameBillingRace.filter((item) => item.response.status === 409 && ["INVOICE_ALREADY_EXISTS", "BILLING_ALREADY_ISSUED"].includes(item.body.error.code));
  assert(sameBillingSuccesses.length === 1 && sameBillingConflicts.length === 1, `Concurrent invoice creation for one billing record did not produce exactly one success — got statuses ${sameBillingRace.map((item) => item.response.status).join(",")}`);

  // Concurrency: two DIFFERENT billing records issued at the same time must get unique, non-colliding invoice numbers
  // from the shared property/month counter.
  const [billingC, billingD] = await Promise.all([
    post(token, `${path}/billing`, { roomId: roomC.body.data.id, billingMonth: "2026-08", ...meters }),
    post(token, `${path}/billing`, { roomId: roomD.body.data.id, billingMonth: "2026-08", ...meters }),
  ]);
  const distinctInvoiceRace = await Promise.all([
    post(token, `${path}/invoices`, { billingId: billingC.body.data.id }),
    post(token, `${path}/invoices`, { billingId: billingD.body.data.id }),
  ]);
  for (const item of distinctInvoiceRace) assert(item.response.status === 201, "Concurrent invoice creation for distinct billing records failed");
  const numbers = distinctInvoiceRace.map((item) => item.body.data.invoiceNumber);
  assert(new Set(numbers).size === numbers.length, `Concurrent invoice creation produced duplicate invoice numbers: ${numbers.join(", ")}`);

  const markedPaid = await post(token, `${path}/invoices/${invoiceA.body.data.id}/mark-paid`, {});
  assert(markedPaid.response.status === 200 && markedPaid.body.data.status === "paid", "Mark-paid failed");
  const billingAfterPaid = await request(token, `${path}/billing/${billingA.body.data.id}`);
  assert(billingAfterPaid.body.data.status === "paid", "Billing record was not synchronized to paid");
  const markedPaidAgain = await post(token, `${path}/invoices/${invoiceA.body.data.id}/mark-paid`, {});
  assert(markedPaidAgain.response.status === 409 && markedPaidAgain.body.error.code === "INVOICE_ALREADY_PAID", "Double mark-paid was not rejected");

  const billingE = await post(token, `${path}/billing`, { roomId: roomE.body.data.id, billingMonth: "2026-08", ...meters });
  const invoiceE = await post(token, `${path}/invoices`, { billingId: billingE.body.data.id });
  const invalidPaidAt = await post(token, `${path}/invoices/${invoiceE.body.data.id}/mark-paid`, { paidAt: "2020-01-01T00:00:00.000Z" });
  assert(invalidPaidAt.response.status === 400 && invalidPaidAt.body.error.code === "INVALID_PAYMENT_DATE", "paidAt preceding issuedAt was accepted");

  // Property isolation: an invoice ID from property A must 404 (not leak) under a second, unrelated property.
  const otherProperty = await post(token, "/properties", { name: "Invoice verification property 2" });
  const crossProperty = await request(token, `/properties/${otherProperty.body.data.id}/invoices/${invoiceA.body.data.id}`);
  assert(crossProperty.response.status === 404 && crossProperty.body.error.code === "INVOICE_NOT_FOUND", "Cross-property invoice access was not rejected as not-found");

  // Snapshot integrity: editing the room/tenant after issuance must not change the already-issued invoice.
  await request(token, `${path}/rooms/${roomA.body.data.id}`, { method: "PATCH", body: JSON.stringify({ roomNumber: "I-101-RENAMED", monthlyRent: 9999 }) });
  const afterEdit = await request(token, `${path}/invoices/${invoiceA.body.data.id}`);
  assert(afterEdit.body.data.roomSnapshot.roomNumber === "I-101" && afterEdit.body.data.items[0].amount === 5000, "Issued invoice snapshot changed after editing the room master");

  process.stdout.write("Invoice API Emulator verification passed.\n");
}

verifyInvoices().catch((error) => {
  process.stderr.write(`Invoice API Emulator verification failed: ${error.message}\n`);
  process.exitCode = 1;
});
