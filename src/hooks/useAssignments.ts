import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, type Timestamp } from "firebase/firestore";
import { useAuth } from "@/auth";
import { assignmentRepository } from "@/data/repositories/assignmentRepository";
import { timestampToIso } from "@/data/repositories/converters/timestamp";
import { db } from "@/lib/firebase";
import { getActivePropertyId } from "@/lib/activeProperty";
import type { RoomTenantAssignment, CreateAssignmentInput } from "@/types/assignment";

// `startDate`/`endDate`/`createdAt`/`updatedAt` are written as Firestore
// `Timestamp`s (assignmentRepository.assign/endByRoomId) but the domain type
// declares all four as ISO strings — convert on every read, same pattern as
// `firestoreCrud.ts`'s `toDoc()`. `endDate` is allowed to stay `undefined`:
// the type already makes it optional, and `timestampToIso(null)` correctly
// returns `undefined` for the common "still active, no end date" case.
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

export function useAssignments() {
  const { user } = useAuth();
  const propertyId = getActivePropertyId(user?.propertyIds ?? []);
  const [assignments, setAssignments] = useState<RoomTenantAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onSnapshot(collection(db, "properties", propertyId, "assignments"), (snapshot) => {
      setAssignments(snapshot.docs.map((d) => toAssignment(d.id, d.data())));
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
