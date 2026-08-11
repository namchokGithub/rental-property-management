const { getApp, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

function initializeFirebaseAdmin() {
  if (getApps().length > 0) return getApp();

  try {
    return initializeApp();
  } catch (error) {
    logger.error("Firebase Admin initialization failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

const firebaseApp = initializeFirebaseAdmin();
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

module.exports = { firebaseApp, db, auth };
