const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../config/firebase");
const collection = db.collection("rooms");
const toDocument = (snapshot) => (snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null);
async function findAllByProperty(propertyId, filters = {}) { let query = collection.where("propertyId", "==", propertyId); if (filters.status) query = query.where("status", "==", filters.status); if (filters.floor) query = query.where("floor", "==", filters.floor); return (await query.orderBy("roomNumber", "asc").get()).docs.map(toDocument); }
async function findById(id) { return toDocument(await collection.doc(id).get()); }
async function create(data) { const reference = collection.doc(); await reference.set({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); return { id: reference.id, ...data }; }
async function update(id, data) { await collection.doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() }); return { id, ...data }; }
async function remove(id) { await collection.doc(id).delete(); }
module.exports = { findAllByProperty, findById, create, update, remove };
