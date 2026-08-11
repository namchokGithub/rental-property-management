import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import type { RoomTenantAssignment, CreateAssignmentInput } from "@/types/assignment";

function all(): RoomTenantAssignment[] {
  return readCollection<RoomTenantAssignment>(STORAGE_KEYS.assignments);
}

export const assignmentRepository = {
  getAll(): RoomTenantAssignment[] {
    return all();
  },
  getById(id: string): RoomTenantAssignment | undefined {
    return all().find((a) => a.id === id);
  },
  getActiveByRoomId(roomId: string): RoomTenantAssignment | undefined {
    return all().find((a) => a.roomId === roomId && a.status === "active");
  },
  getActiveByTenantId(tenantId: string): RoomTenantAssignment | undefined {
    return all().find((a) => a.tenantId === tenantId && a.status === "active");
  },
  getByTenantId(tenantId: string): RoomTenantAssignment[] {
    return all().filter((a) => a.tenantId === tenantId);
  },
  getByRoomId(roomId: string): RoomTenantAssignment[] {
    return all().filter((a) => a.roomId === roomId);
  },
  /**
   * Ends any existing active assignment for the room, creates a new active
   * one. Does NOT touch room status itself (rooms live in Firestore now,
   * assignments are still local-storage-only pending Task 4) — callers with
   * access to `roomRepository`/`propertyId` are responsible for that side
   * effect (see `useAssignments`).
   */
  assign(input: CreateAssignmentInput): RoomTenantAssignment {
    const assignments = all();
    const now = new Date().toISOString();
    const ended = assignments.map((a) =>
      a.roomId === input.roomId && a.status === "active"
        ? { ...a, status: "ended" as const, endDate: input.startDate }
        : a
    );
    const created: RoomTenantAssignment = {
      id: crypto.randomUUID(),
      roomId: input.roomId,
      tenantId: input.tenantId,
      startDate: input.startDate,
      status: "active",
      createdAt: now,
    };
    writeCollection(STORAGE_KEYS.assignments, [...ended, created]);
    return created;
  },
  /** Ends the active assignment for a room. Room-status side effect: see `assign` above. */
  endByRoomId(roomId: string, endDate: string): void {
    const assignments = all();
    const updated = assignments.map((a) =>
      a.roomId === roomId && a.status === "active" ? { ...a, status: "ended" as const, endDate } : a
    );
    writeCollection(STORAGE_KEYS.assignments, updated);
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.assignments, all().filter((a) => a.id !== id));
  },
};
