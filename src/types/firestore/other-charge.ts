import type { FirestoreTimestamp } from "@/types/firestore/timestamp";

export interface OtherChargeMaster {
  id: string;
  propertyId: string;
  nameTh: string;
  nameEn?: string;
  defaultAmount: number;
  isActive: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
