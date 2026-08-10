import { useCallback, useState } from "react";
import { assignmentRepository } from "@/data/repositories/assignmentRepository";
import type { RoomTenantAssignment, CreateAssignmentInput } from "@/types/assignment";

export function useAssignments() {
  const [assignments, setAssignments] = useState<RoomTenantAssignment[]>(() => assignmentRepository.getAll());

  const refresh = useCallback(() => setAssignments(assignmentRepository.getAll()), []);

  const assignTenant = useCallback(
    (input: CreateAssignmentInput) => {
      const assignment = assignmentRepository.assign(input);
      refresh();
      return assignment;
    },
    [refresh]
  );

  const endTenancyByRoomId = useCallback(
    (roomId: string, endDate: string) => {
      assignmentRepository.endByRoomId(roomId, endDate);
      refresh();
    },
    [refresh]
  );

  const getActiveByRoomId = useCallback((roomId: string) => assignmentRepository.getActiveByRoomId(roomId), []);
  const getByRoomId = useCallback((roomId: string) => assignmentRepository.getByRoomId(roomId), []);
  const getActiveByTenantId = useCallback((tenantId: string) => assignmentRepository.getActiveByTenantId(tenantId), []);

  return { assignments, refresh, assignTenant, endTenancyByRoomId, getActiveByRoomId, getByRoomId, getActiveByTenantId };
}
