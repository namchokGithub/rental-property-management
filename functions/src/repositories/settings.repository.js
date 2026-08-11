const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../config/firebase");

const collection = db.collection("propertySettings");

async function findByPropertyId(propertyId) {
  const snapshot = await collection.doc(propertyId).get();
  return snapshot.exists ? { propertyId: snapshot.id, ...snapshot.data() } : null;
}

async function upsert(propertyId, data) {
  const reference = collection.doc(propertyId);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    transaction.set(
      reference,
      {
        propertyId,
        ...data,
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  return { propertyId, ...data };
}

module.exports = { findByPropertyId, upsert };
