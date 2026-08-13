import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createFirestoreCrudRepository } from "@/data/repositories/firestoreCrud";
import type { CreateRoomInput, Room, UpdateRoomInput } from "@/types/room";

/**
 * Thrown by `roomRepository.delete()` when the room still has an active
 * tenant assignment. Callers (`RoomsPage.tsx`) check for this specific type
 * via `instanceof` to show the translated delete-guard message instead of
 * this error's raw English `.message` — same pattern as
 * `InvalidCredentialsError` in `auth.types.ts`.
 */
export class RoomHasActiveAssignmentError extends Error {
  constructor() {
    super("Cannot delete a room with an active tenant assignment");
    this.name = "RoomHasActiveAssignmentError";
  }
}

/**
 * Deleting a room that still has an active tenant assignment would silently
 * orphan that assignment's billing/history. The old backend enforced this;
 * carried over here rather than deferred to the Assignments migration (Task
 * 4) since it's a real data-integrity gap the moment Rooms goes live.
 * `assignments` has no data yet until Task 4 lands, so this always resolves
 * empty for now — harmless, and load-bearing once assignments are written.
 */
async function assertNoActiveAssignment(propertyId: string, roomId: string): Promise<void> {
  const active = await getDocs(
    query(
      collection(db, "properties", propertyId, "assignments"),
      where("roomId", "==", roomId),
      where("status", "==", "active"),
    ),
  );
  if (!active.empty) throw new RoomHasActiveAssignmentError();
}

export const roomRepository = {
  ...createFirestoreCrudRepository<Room, CreateRoomInput, UpdateRoomInput>("rooms"),
  async delete(propertyId: string, id: string): Promise<void> {
    await assertNoActiveAssignment(propertyId, id);
    await updateDoc(doc(db, "properties", propertyId, "rooms", id), {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },
};
