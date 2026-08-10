export type AssignmentStatus = "active" | "ended";

export interface RoomTenantAssignment {
  id: string;
  roomId: string;
  tenantId: string;
  startDate: string;
  endDate?: string;
  status: AssignmentStatus;
  createdAt: string;
}

export type CreateAssignmentInput = Pick<RoomTenantAssignment, "roomId" | "tenantId" | "startDate">;
