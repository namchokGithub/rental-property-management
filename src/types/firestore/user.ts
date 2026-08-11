import type { FirestoreTimestamp } from "@/types/firestore/timestamp";

export type UserRole = "admin" | "staff";

/** Application profile keyed by the matching Firebase Authentication UID. */
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  propertyIds: string[];
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
