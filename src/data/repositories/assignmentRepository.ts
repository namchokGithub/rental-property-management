import { collection, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { timestampToIso } from "@/data/repositories/converters/timestamp";
import type { CreateAssignmentInput, RoomTenantAssignment } from "@/types/assignment";

function assignmentsRef(propertyId: string) {
  return collection(db, "properties", propertyId, "assignments");
}

function toAssignment(id: string, data: Record<string, unknown>): RoomTenantAssignment {
  return {
    id,
    ...data,
    startDate: timestampToIso(data.startDate as Timestamp | null | undefined) ?? new Date().toISOString(),
    endDate: timestampToIso(data.endDate as Timestamp | null | undefined),
    createdAt: timestampToIso(data.createdAt as Timestamp | null | undefined) ?? new Date().toISOString(),
    updatedAt: timestampToIso(data.updatedAt as Timestamp | null | undefined) ?? new Date().toISOString(),
  } as RoomTenantAssignment;
}

/**
 * Ports `functions/src/services/assignments.service.js`'s (deleted) backend
 * logic to client-side `runTransaction()` calls, since assign/end is the
 * read-modify-write path that needs Firestore's optimistic-concurrency
 * guarantees now that there's no server enforcing them.
 *
 * One adaptation from a literal port: the web client SDK's
 * `Transaction.get()` only accepts a `DocumentReference` — there is no
 * `transaction.get(query)` overload (some server SDKs have one; this one
 * doesn't). The active-assignment lookups below therefore run as plain
 * `getDocs()` queries *inside* the transaction callback rather than through
 * `transaction.get()`. This still closes the race the deleted backend closed
 * with the same "touch the tenant doc" trick: `runTransaction` re-invokes
 * this whole callback from scratch on retry, and a retry is exactly what
 * happens when two callers race for the same room or tenant, because both
 * write `roomRef`/`tenantRef` and Firestore aborts-and-retries whichever one
 * loses that document-version conflict. The loser's retried query then
 * observes the winner's already-committed assignment and throws the
 * ordinary business-rule error below instead of double-booking. This is
 * Firestore's documented workaround for the missing query-in-transaction
 * capability on this SDK.
 */
export const assignmentRepository = {
  subscribe(propertyId: string, callback: (assignments: RoomTenantAssignment[]) => void): Unsubscribe {
    return onSnapshot(assignmentsRef(propertyId), (snapshot) => {
      callback(snapshot.docs.map((document) => toAssignment(document.id, document.data())));
    });
  },

  async assign(propertyId: string, input: CreateAssignmentInput): Promise<string> {
    return runTransaction(db, async (transaction) => {
      const roomRef = doc(db, "properties", propertyId, "rooms", input.roomId);
      const tenantRef = doc(db, "properties", propertyId, "tenants", input.tenantId);

      const [roomSnap, tenantSnap, activeForRoom, activeForTenant] = await Promise.all([
        transaction.get(roomRef),
        transaction.get(tenantRef),
        getDocs(
          query(assignmentsRef(propertyId), where("roomId", "==", input.roomId), where("status", "==", "active")),
        ),
        getDocs(
          query(
            assignmentsRef(propertyId),
            where("tenantId", "==", input.tenantId),
            where("status", "==", "active"),
          ),
        ),
      ]);
      if (!roomSnap.exists()) throw new Error("Room not found");
      if (!tenantSnap.exists()) throw new Error("Tenant not found");
      const room = roomSnap.data();
      const tenant = tenantSnap.data();
      if (room.status === "maintenance" || room.status === "inactive") {
        throw new Error("Room is not available for assignment");
      }
      if (tenant.status !== "active") throw new Error("Tenant is not active");
      if (!activeForRoom.empty) throw new Error("Room already has an active tenant");
      if (!activeForTenant.empty) throw new Error("Tenant already has an active room assignment");

      const assignmentRef = doc(assignmentsRef(propertyId));
      transaction.set(assignmentRef, {
        roomId: input.roomId,
        tenantId: input.tenantId,
        startDate: Timestamp.fromDate(new Date(input.startDate)),
        endDate: null,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(roomRef, { status: "occupied", updatedAt: serverTimestamp() });
      // No-op field touch on the tenant doc — see the module comment above:
      // this is what forces Firestore to detect two simultaneous assign()
      // calls for the same tenant and retry the loser. Mirrors the deleted
      // backend's identical trick.
      transaction.update(tenantRef, { updatedAt: serverTimestamp() });
      return assignmentRef.id;
    });
  },

  async endByRoomId(propertyId: string, roomId: string, endDate: string): Promise<void> {
    const roomRef = doc(db, "properties", propertyId, "rooms", roomId);
    await runTransaction(db, async (transaction) => {
      // See the module comment: found via a plain query (no
      // transaction.get(query) overload), then pinned by ref via
      // transaction.get() below for the real transactional guarantee.
      const activeSnap = await getDocs(
        query(assignmentsRef(propertyId), where("roomId", "==", roomId), where("status", "==", "active")),
      );
      if (activeSnap.empty) return;
      const assignmentRef = activeSnap.docs[0].ref;

      const [assignmentSnap, roomSnap] = await Promise.all([
        transaction.get(assignmentRef),
        transaction.get(roomRef),
      ]);
      // Re-check freshness: another caller may have already ended (or
      // re-ended) this exact assignment between the query above and this
      // transactionally-pinned read.
      if (!assignmentSnap.exists() || assignmentSnap.data().status !== "active") return;

      transaction.update(assignmentRef, {
        status: "ended",
        endDate: Timestamp.fromDate(new Date(endDate)),
        updatedAt: serverTimestamp(),
      });
      if (roomSnap.exists() && roomSnap.data().status === "occupied") {
        transaction.update(roomRef, { status: "available", updatedAt: serverTimestamp() });
      }
    });
  },
};
