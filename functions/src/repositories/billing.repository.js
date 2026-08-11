const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../config/firebase");
const billingRecords = db.collection("billingRecords");
const rooms = db.collection("rooms");
const tenants = db.collection("tenants");
const settings = db.collection("propertySettings");
const assignments = db.collection("roomAssignments");
const chargeMasters = db.collection("otherChargeMasters");
const toDocument = (snapshot) => (snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null);

async function findAllByProperty(propertyId, filters = {}) {
  const documents = (await billingRecords.where("propertyId", "==", propertyId).orderBy("billingMonth", "desc").orderBy("createdAt", "desc").get()).docs.map(toDocument);
  return documents.filter((record) => Object.entries(filters).every(([key, value]) => record[key] === value));
}
async function findById(id) { return toDocument(await billingRecords.doc(id).get()); }
async function findByRoomAndMonth(propertyId, roomId, billingMonth) {
  const result = await billingRecords.where("propertyId", "==", propertyId).where("roomId", "==", roomId).where("billingMonth", "==", billingMonth).limit(1).get();
  return result.empty ? null : toDocument(result.docs[0]);
}
function billingByRoomAndMonthQuery(propertyId, roomId, billingMonth) { return billingRecords.where("propertyId", "==", propertyId).where("roomId", "==", roomId).where("billingMonth", "==", billingMonth).limit(1); }
function activeAssignmentQuery(propertyId, roomId) { return assignments.where("propertyId", "==", propertyId).where("roomId", "==", roomId).where("status", "==", "active").limit(1); }
module.exports = { db, FieldValue, toDocument, findAllByProperty, findById, findByRoomAndMonth, billingByRoomAndMonthQuery, activeAssignmentQuery, references: { billingRecords, rooms, tenants, settings, chargeMasters } };
