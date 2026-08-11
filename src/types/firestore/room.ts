import type { FirestoreTimestamp } from "@/types/firestore/timestamp";

export type RoomStatus = "available" | "occupied" | "maintenance" | "inactive";

export interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor?: string;
  type?: string;
  monthlyRent: number;
  status: RoomStatus;
  description?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
