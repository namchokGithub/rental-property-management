const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../config/firebase");

const assignments = db.collection("roomAssignments");
const rooms = db.collection("rooms");
const tenants = db.collection("tenants");
const toDocument = (snapshot) => (snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null);

function queryByProperty(propertyId, filters = {}) {
  let query = assignments.where("propertyId", "==", propertyId);
  if (filters.status) query = query.where("status", "==", filters.status);
  if (filters.roomId) query = query.where("roomId", "==", filters.roomId);
  if (filters.tenantId) query = query.where("tenantId", "==", filters.tenantId);
  return query.orderBy("startDate", "desc");
}

async function findAllByProperty(propertyId, filters = {}) {
  return (await queryByProperty(propertyId, filters).get()).docs.map(toDocument);
}

async function findById(id) {
  return toDocument(await assignments.doc(id).get());
}

function activeByRoomQuery(propertyId, roomId) {
  return assignments.where("propertyId", "==", propertyId).where("roomId", "==", roomId).where("status", "==", "active");
}

function activeByTenantQuery(propertyId, tenantId) {
  return assignments.where("propertyId", "==", propertyId).where("tenantId", "==", tenantId).where("status", "==", "active");
}

async function findActiveByRoom(propertyId, roomId) {
  const snapshot = await activeByRoomQuery(propertyId, roomId).limit(1).get();
  return snapshot.empty ? null : toDocument(snapshot.docs[0]);
}

async function findActiveByTenant(propertyId, tenantId) {
  const snapshot = await activeByTenantQuery(propertyId, tenantId).limit(1).get();
  return snapshot.empty ? null : toDocument(snapshot.docs[0]);
}

async function removeRoomIfNoActiveAssignment(roomId) {
  return db.runTransaction(async (transaction) => {
    const room = await transaction.get(rooms.doc(roomId));
    if (!room.exists) return "missing";
    const active = await transaction.get(activeByRoomQuery(room.data().propertyId, roomId).limit(1));
    if (!active.empty) return "active";
    const history = await transaction.get(assignments.where("propertyId", "==", room.data().propertyId).where("roomId", "==", roomId).limit(1));
    if (!history.empty) return "history";
    transaction.delete(room.ref);
    return "removed";
  });
}

async function removeTenantIfNoActiveAssignment(tenantId) {
  return db.runTransaction(async (transaction) => {
    const tenant = await transaction.get(tenants.doc(tenantId));
    if (!tenant.exists) return "missing";
    const active = await transaction.get(activeByTenantQuery(tenant.data().propertyId, tenantId).limit(1));
    if (!active.empty) return "active";
    const history = await transaction.get(assignments.where("propertyId", "==", tenant.data().propertyId).where("tenantId", "==", tenantId).limit(1));
    if (!history.empty) return "history";
    transaction.delete(tenant.ref);
    return "removed";
  });
}

module.exports = {
  findAllByProperty,
  findById,
  findActiveByRoom,
  findActiveByTenant,
  removeRoomIfNoActiveAssignment,
  removeTenantIfNoActiveAssignment,
  references: { assignments, rooms, tenants },
  activeByRoomQuery,
  activeByTenantQuery,
  toDocument,
  db,
  FieldValue,
};
