import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type CollectionReference,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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

  return {
    async getAll(propertyId: string): Promise<TDoc[]> {
      const snapshot = await getDocs(collectionRef(propertyId));
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TDoc);
    },

    subscribe(propertyId: string, callback: (items: TDoc[]) => void): Unsubscribe {
      return onSnapshot(collectionRef(propertyId), (snapshot) => {
        callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TDoc));
      });
    },

    async create(propertyId: string, input: TCreateInput): Promise<string> {
      const ref = await addDoc(collectionRef(propertyId), {
        ...input,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },

    async update(propertyId: string, id: string, input: TUpdateInput): Promise<void> {
      await updateDoc(doc(collectionRef(propertyId), id), { ...input, updatedAt: serverTimestamp() });
    },

    async delete(propertyId: string, id: string): Promise<void> {
      await deleteDoc(doc(collectionRef(propertyId), id));
    },
  };
}
