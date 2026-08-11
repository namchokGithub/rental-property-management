import { Timestamp } from "firebase/firestore";

export function timestampToIso(value: Timestamp | null | undefined): string | undefined {
  return value ? value.toDate().toISOString() : undefined;
}

export function isoToTimestamp(value: string | null | undefined): Timestamp | null {
  return value ? Timestamp.fromDate(new Date(value)) : null;
}
