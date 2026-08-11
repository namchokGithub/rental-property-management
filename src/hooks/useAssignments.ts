import { useCallback, useState } from "react";
import { useAuth } from "@/auth";
import { assignmentRepository } from "@/data/repositories/assignmentRepository";
import { roomRepository } from "@/data/repositories/roomRepository";
import { useRooms } from "@/hooks/useRooms";
import { getActivePropertyId } from "@/lib/activeProperty";
import type { RoomTenantAssignment, CreateAssignmentInput } from "@/types/assignment";

/**
 * Assignments themselves are still local-storage-only (Task 4 migrates them
 * to Firestore, with the transactional room<->tenant<->assignment writes
 * that need). Rooms already moved to Firestore in this task, so the
 * room-status side effect that used to live inside `assignmentRepository`
 * (flip to "occupied"/"available") is handled here instead, where
 * `propertyId` and the live `rooms` list are available.
 */
export function useAssignments() {
  const { user } = useAuth();
  const propertyId = getActivePropertyId(user?.propertyIds ?? []);
  const { rooms } = useRooms();
  const [assignments, setAssignments] = useState<RoomTenantAssignment[]>(() => assignmentRepository.getAll());

  const refresh = useCallback(() => setAssignments(assignmentRepository.getAll()), []);

  const assignTenant = useCallback(
    (input: CreateAssignmentInput) => {
      const assignment = assignmentRepository.assign(input);
      void roomRepository.update(propertyId, input.roomId, { status: "occupied" });
      refresh();
      return assignment;
    },
    [refresh, propertyId]
  );

  const endTenancyByRoomId = useCallback(
    (roomId: string, endDate: string) => {
      assignmentRepository.endByRoomId(roomId, endDate);
      const room = rooms.find((r) => r.id === roomId);
      if (room && room.status === "occupied") {
        void roomRepository.update(propertyId, roomId, { status: "available" });
      }
      refresh();
    },
    [refresh, propertyId, rooms]
  );

  const getActiveByRoomId = useCallback((roomId: string) => assignmentRepository.getActiveByRoomId(roomId), []);
  const getByRoomId = useCallback((roomId: string) => assignmentRepository.getByRoomId(roomId), []);
  const getActiveByTenantId = useCallback((tenantId: string) => assignmentRepository.getActiveByTenantId(tenantId), []);

  return { assignments, refresh, assignTenant, endTenancyByRoomId, getActiveByRoomId, getByRoomId, getActiveByTenantId };
}
