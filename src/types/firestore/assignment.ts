import type { FirestoreTimestamp } from "@/types/firestore/timestamp";

export type AssignmentStatus = "active" | "ended";

export interface RoomTenantAssignment {
  id: string;
  propertyId: string;
  roomId: string;
  tenantId: string;
  startDate: FirestoreTimestamp;
  endDate?: FirestoreTimestamp | null;
  status: AssignmentStatus;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
