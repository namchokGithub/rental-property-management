import type { FirestoreTimestamp } from "@/types/firestore/timestamp";

export interface PropertySettings {
  propertyId: string;
  defaultElectricityRate: number;
  defaultWaterRate: number;
  defaultInvoiceNote: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
