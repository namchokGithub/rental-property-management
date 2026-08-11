import { useCallback, useEffect, useState } from "react";
import { assignmentRepository } from "@/data/repositories/assignmentRepository";
import { useActivePropertyId } from "@/property";
import type { RoomTenantAssignment, CreateAssignmentInput } from "@/types/assignment";

export function useAssignments() {
  const propertyId = useActivePropertyId();
  const [assignments, setAssignments] = useState<RoomTenantAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = assignmentRepository.subscribe(propertyId, (next) => {
      setAssignments(next);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [propertyId]);

  const assignTenant = useCallback(
    (input: CreateAssignmentInput) => assignmentRepository.assign(propertyId, input),
    [propertyId],
  );
  const endTenancyByRoomId = useCallback(
    (roomId: string, endDate: string) => assignmentRepository.endByRoomId(propertyId, roomId, endDate),
    [propertyId],
  );
  const getActiveByRoomId = useCallback(
    (roomId: string) => assignments.find((a) => a.roomId === roomId && a.status === "active"),
    [assignments],
  );
  const getActiveByTenantId = useCallback(
    (tenantId: string) => assignments.find((a) => a.tenantId === tenantId && a.status === "active"),
    [assignments],
  );

  return { assignments, isLoading, assignTenant, endTenancyByRoomId, getActiveByRoomId, getActiveByTenantId };
}
