import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createFirestoreCrudRepository } from "@/data/repositories/firestoreCrud";
import type { CreateRoomInput, Room, UpdateRoomInput } from "@/types/room";

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
  if (!active.empty) throw new Error("Cannot delete a room with an active tenant assignment");
}

export const roomRepository = {
  ...createFirestoreCrudRepository<Room, CreateRoomInput, UpdateRoomInput>("rooms"),
  async delete(propertyId: string, id: string): Promise<void> {
    await assertNoActiveAssignment(propertyId, id);
    await deleteDoc(doc(db, "properties", propertyId, "rooms", id));
  },
};
