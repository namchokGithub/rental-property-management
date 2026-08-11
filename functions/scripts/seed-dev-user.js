if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT) {
  throw new Error(
    "This script only runs against emulators. Set FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST, and GCLOUD_PROJECT."
  );
}

const { FieldValue } = require("firebase-admin/firestore");
const { auth, db } = require("../src/config/firebase");

const email = process.env.DEV_USER_EMAIL || "admin@example.test";
const password = process.env.DEV_USER_PASSWORD;
const propertyId = process.env.DEV_PROPERTY_ID || "demo-property";

if (!password) {
  throw new Error("Set DEV_USER_PASSWORD before seeding the development Auth Emulator user.");
}

async function getOrCreateUser() {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    return auth.createUser({ email, password, displayName: "Development Administrator" });
  }
}

async function seedDevelopmentUser() {
  const user = await getOrCreateUser();
  const profileReference = db.collection("users").doc(user.uid);
  const profile = await profileReference.get();
  const data = {
    email,
    displayName: "Development Administrator",
    role: "admin",
    propertyIds: [propertyId],
    isActive: true,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await profileReference.set(profile.exists ? data : { ...data, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  process.stdout.write(`Seeded development user profile for UID ${user.uid}.\n`);
}

seedDevelopmentUser().catch((error) => {
  process.stderr.write(`Development user seed failed: ${error.message}\n`);
  process.exitCode = 1;
});
