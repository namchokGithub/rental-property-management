/**
 * Structural stand-in for Firebase's `Timestamp` during the architecture-only
 * phase. Once Firebase is installed, this may become a type-only import from
 * `firebase/firestore`; it intentionally has no runtime dependency today.
 */
export interface FirestoreTimestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
  isEqual(other: FirestoreTimestamp): boolean;
}
