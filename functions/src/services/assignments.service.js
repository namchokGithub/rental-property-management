const { Timestamp } = require("firebase-admin/firestore");
const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");
const { ensurePropertyAccess } = require("./property-access.service");
const repository = require("../repositories/assignments.repository");

const BANGKOK_TIME_ZONE = "Asia/Bangkok";

function dateToTimestamp(date) {
  return Timestamp.fromDate(new Date(`${date}T00:00:00.000+07:00`));
}

function todayInBangkok() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: BANGKOK_TIME_ZONE }).format(new Date());
}

function timestampToBangkokDate(value) {
  if (!value || typeof value.toDate !== "function") return null;
  return new Intl.DateTimeFormat("sv-SE", { timeZone: BANGKOK_TIME_ZONE }).format(value.toDate());
}

function createAssignmentsService({ repo = repository, access = ensurePropertyAccess } = {}) {
  async function owned(user, propertyId, id) {
    access(user, propertyId);
    const assignment = await repo.findById(id);
    if (!assignment || assignment.propertyId !== propertyId) throw new AppError(404, ERROR_CODES.ASSIGNMENT_NOT_FOUND, "Assignment not found");
    return assignment;
  }

  return {
    async list(user, propertyId, filters) {
      access(user, propertyId);
      return repo.findAllByProperty(propertyId, filters);
    },

    async get(user, propertyId, id) {
      return owned(user, propertyId, id);
    },

    async create(user, propertyId, data) {
      access(user, propertyId);
      const assignmentId = await repo.db.runTransaction(async (transaction) => {
        const roomReference = repo.references.rooms.doc(data.roomId);
        const tenantReference = repo.references.tenants.doc(data.tenantId);
        const [roomSnapshot, tenantSnapshot] = await Promise.all([
          transaction.get(roomReference),
          transaction.get(tenantReference),
        ]);

        if (!roomSnapshot.exists) throw new AppError(404, ERROR_CODES.ROOM_NOT_FOUND, "Room not found");
        if (!tenantSnapshot.exists) throw new AppError(404, ERROR_CODES.TENANT_NOT_FOUND, "Tenant not found");
        const room = roomSnapshot.data();
        const tenant = tenantSnapshot.data();
        if (room.propertyId !== propertyId || tenant.propertyId !== propertyId) {
          throw new AppError(400, ERROR_CODES.ASSIGNMENT_PROPERTY_MISMATCH, "Room and tenant must belong to this property");
        }
        if (room.status === "maintenance" || room.status === "inactive") {
          throw new AppError(409, ERROR_CODES.ROOM_NOT_AVAILABLE, "Room is not available for assignment");
        }
        if (tenant.status !== "active") throw new AppError(409, ERROR_CODES.TENANT_NOT_ACTIVE, "Tenant is not active");

        const [activeRoomAssignments, activeTenantAssignments] = await Promise.all([
          transaction.get(repo.activeByRoomQuery(propertyId, data.roomId).limit(1)),
          transaction.get(repo.activeByTenantQuery(propertyId, data.tenantId).limit(1)),
        ]);
        if (!activeRoomAssignments.empty) throw new AppError(409, ERROR_CODES.ROOM_ALREADY_OCCUPIED, "Room already has an active assignment");
        if (!activeTenantAssignments.empty) throw new AppError(409, ERROR_CODES.TENANT_ALREADY_ASSIGNED, "Tenant already has an active assignment");

        const assignmentReference = repo.references.assignments.doc();
        transaction.create(assignmentReference, {
          propertyId,
          roomId: data.roomId,
          tenantId: data.tenantId,
          startDate: dateToTimestamp(data.startDate),
          endDate: null,
          status: "active",
          createdAt: repo.FieldValue.serverTimestamp(),
          updatedAt: repo.FieldValue.serverTimestamp(),
        });
        transaction.update(roomReference, { status: "occupied", updatedAt: repo.FieldValue.serverTimestamp() });
        // This no-op domain update serializes competing assignments for one tenant.
        transaction.update(tenantReference, { updatedAt: repo.FieldValue.serverTimestamp() });
        return assignmentReference.id;
      });
      return repo.findById(assignmentId);
    },

    async end(user, propertyId, id, data) {
      access(user, propertyId);
      const assignmentId = await repo.db.runTransaction(async (transaction) => {
        const assignmentReference = repo.references.assignments.doc(id);
        const assignmentSnapshot = await transaction.get(assignmentReference);
        if (!assignmentSnapshot.exists || assignmentSnapshot.data().propertyId !== propertyId) {
          throw new AppError(404, ERROR_CODES.ASSIGNMENT_NOT_FOUND, "Assignment not found");
        }
        const assignment = assignmentSnapshot.data();
        if (assignment.status !== "active") throw new AppError(409, ERROR_CODES.ASSIGNMENT_ALREADY_ENDED, "Assignment has already ended");
        const startDate = timestampToBangkokDate(assignment.startDate);
        const endDate = data.endDate || todayInBangkok();
        if (!startDate || endDate < startDate) {
          throw new AppError(400, ERROR_CODES.INVALID_ASSIGNMENT_DATE, "End date cannot be earlier than start date");
        }

        const [roomSnapshot, tenantSnapshot] = await Promise.all([
          transaction.get(repo.references.rooms.doc(assignment.roomId)),
          transaction.get(repo.references.tenants.doc(assignment.tenantId)),
        ]);
        if (!roomSnapshot.exists) throw new AppError(404, ERROR_CODES.ROOM_NOT_FOUND, "Room not found");

        transaction.update(assignmentReference, {
          status: "ended",
          endDate: dateToTimestamp(endDate),
          updatedAt: repo.FieldValue.serverTimestamp(),
        });
        const room = roomSnapshot.data();
        if (room.status === "occupied") {
          transaction.update(roomSnapshot.ref, { status: "available", updatedAt: repo.FieldValue.serverTimestamp() });
        }
        // Keep tenant status independent, while serializing a concurrent reassignment.
        if (tenantSnapshot.exists) transaction.update(tenantSnapshot.ref, { updatedAt: repo.FieldValue.serverTimestamp() });
        return assignmentReference.id;
      });
      return repo.findById(assignmentId);
    },
  };
}

module.exports = { assignmentsService: createAssignmentsService(), createAssignmentsService, BANGKOK_TIME_ZONE };
