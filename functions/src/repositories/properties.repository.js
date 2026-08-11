const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../config/firebase");

const collection = db.collection("properties");

function toDocument(snapshot) {
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function findById(id) {
  return toDocument(await collection.doc(id).get());
}

async function findByIds(ids) {
  if (ids.length === 0) return [];
  const snapshots = await db.getAll(...ids.map((id) => collection.doc(id)));
  return snapshots.map(toDocument).filter(Boolean);
}

async function createForOwner(ownerUid, data) {
  const propertyReference = collection.doc();
  const userReference = db.collection("users").doc(ownerUid);

  await db.runTransaction(async (transaction) => {
    transaction.set(propertyReference, {
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(userReference, {
      propertyIds: FieldValue.arrayUnion(propertyReference.id),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { id: propertyReference.id, ...data };
}

async function update(id, data) {
  await collection.doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
  return { id, ...data };
}

module.exports = { findById, findByIds, createForOwner, update };
