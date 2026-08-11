import type { FirestoreTimestamp } from "@/types/firestore/timestamp";

export type TenantStatus = "active" | "inactive";

export interface Tenant {
  id: string;
  propertyId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  identificationNumber?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status: TenantStatus;
  notes?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
