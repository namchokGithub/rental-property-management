import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type CollectionReference,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { timestampToIso } from "@/data/repositories/converters/timestamp";

// Firestore rejects writes containing an `undefined` field value (the client
// is initialized without `ignoreUndefinedProperties`). Optional form fields
// are commonly built as `value.trim() || undefined`, so every write needs
// this before it reaches `addDoc`/`updateDoc`.
function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/**
 * Generic CRUD factory for property-scoped subcollections
 * (`properties/{propertyId}/{subcollectionName}`) that need nothing beyond
 * plain document CRUD + a live subscription. Assignments and Billing need
 * multi-document transactions, so they don't build on this beyond reads.
 */
export function createFirestoreCrudRepository<TDoc extends { id: string }, TCreateInput, TUpdateInput>(
  subcollectionName: string,
) {
  function collectionRef(propertyId: string): CollectionReference {
    return collection(db, "properties", propertyId, subcollectionName);
  }

  // `createdAt`/`updatedAt` are written via `serverTimestamp()` (a Firestore
  // `Timestamp` at rest) but every `TDoc` declares them as ISO strings for
  // consumers. While a `serverTimestamp()` write is still pending server ack,
  // the local optimistic snapshot resolves the field to `null` — fall back
  // to the client clock so callers always see a valid string, never
  // `undefined`; the real server-committed value arrives in the next
  // snapshot.
  function toDoc(id: string, data: Record<string, unknown>): TDoc {
    return {
      id,
      ...data,
      deletedAt: timestampToIso(data.deletedAt as Timestamp | null | undefined) ?? null,
      createdAt: timestampToIso(data.createdAt as Timestamp | null | undefined) ?? new Date().toISOString(),
      updatedAt: timestampToIso(data.updatedAt as Timestamp | null | undefined) ?? new Date().toISOString(),
    } as unknown as TDoc;
  }

  // Soft-deleted docs (`deletedAt` set) are filtered out here, client-side,
  // rather than via a Firestore `where("deletedAt", "==", null)` query —
  // Firestore's `==` never matches a document where the field is absent
  // entirely, which every pre-existing document is. A query-level filter
  // would silently hide all data created before soft delete existed, with no
  // backfill mechanism available (no backend, no migration scripts).
  function isNotDeleted(data: Record<string, unknown>): boolean {
    return !data.deletedAt;
  }

  return {
    async getAll(propertyId: string): Promise<TDoc[]> {
      const snapshot = await getDocs(collectionRef(propertyId));
      return snapshot.docs.filter((d) => isNotDeleted(d.data())).map((d) => toDoc(d.id, d.data()));
    },

    subscribe(propertyId: string, callback: (items: TDoc[]) => void): Unsubscribe {
      return onSnapshot(collectionRef(propertyId), (snapshot) => {
        callback(snapshot.docs.filter((d) => isNotDeleted(d.data())).map((d) => toDoc(d.id, d.data())));
      });
    },

    async create(propertyId: string, input: TCreateInput): Promise<string> {
      const ref = await addDoc(collectionRef(propertyId), {
        ...stripUndefined(input as unknown as Record<string, unknown>),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },

    async update(propertyId: string, id: string, input: TUpdateInput): Promise<void> {
      await updateDoc(doc(collectionRef(propertyId), id), {
        ...stripUndefined(input as unknown as Record<string, unknown>),
        updatedAt: serverTimestamp(),
      });
    },

    async delete(propertyId: string, id: string): Promise<void> {
      await updateDoc(doc(collectionRef(propertyId), id), { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    },
  };
}
