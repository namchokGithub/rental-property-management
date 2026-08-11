const projectId = process.env.GCLOUD_PROJECT || "demo-rental-property-management";
const region = process.env.FUNCTIONS_REGION || "asia-southeast1";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const email = process.env.DEV_USER_EMAIL || "admin@example.test";
const password = process.env.DEV_USER_PASSWORD;

if (!authEmulatorHost || !password) {
  throw new Error("Set FIREBASE_AUTH_EMULATOR_HOST and DEV_USER_PASSWORD before verifying the Auth Emulator.");
}

const authUrl = `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`;
const apiUrl = `http://127.0.0.1:5001/${projectId}/${region}/api/api/v1/auth/me`;

async function verifyAuthEmulator() {
  const signInResponse = await fetch(authUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const signInBody = await signInResponse.json();
  if (!signInResponse.ok || !signInBody.idToken) {
    throw new Error("Could not obtain an ID token from the Auth Emulator. Seed the development user first.");
  }

  const meResponse = await fetch(apiUrl, {
    headers: { authorization: `Bearer ${signInBody.idToken}` },
  });
  const meBody = await meResponse.json();
  if (!meResponse.ok || meBody.success !== true || meBody.data.email !== email) {
    throw new Error("Authenticated /api/v1/auth/me response did not match the seeded user profile.");
  }

  process.stdout.write("Auth Emulator verification passed.\n");
}

verifyAuthEmulator().catch((error) => {
  process.stderr.write(`Auth Emulator verification failed: ${error.message}\n`);
  process.exitCode = 1;
});
