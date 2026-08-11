import type { FirestoreTimestamp } from "@/types/firestore/timestamp";

export interface Property {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
