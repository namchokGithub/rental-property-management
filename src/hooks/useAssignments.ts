import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth";
import { assignmentRepository } from "@/data/repositories/assignmentRepository";
import { getActivePropertyId } from "@/lib/activeProperty";
import type { RoomTenantAssignment, CreateAssignmentInput } from "@/types/assignment";

export function useAssignments() {
  const { user } = useAuth();
  const propertyId = getActivePropertyId(user?.propertyIds ?? []);
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
