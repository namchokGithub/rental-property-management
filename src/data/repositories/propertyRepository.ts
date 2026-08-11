import { collection, doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AuthRole } from "@/auth/auth.types";
import type { PropertySummary } from "@/types/property";

function toProperty(id: string, data: Record<string, unknown> | undefined): PropertySummary {
  return { id, name: typeof data?.name === "string" && data.name ? data.name : id };
}

function withKnownProperties(properties: PropertySummary[], propertyIds: string[]): PropertySummary[] {
  const byId = new Map(properties.map((property) => [property.id, property]));
  propertyIds.forEach((id) => {
    if (!byId.has(id)) byId.set(id, toProperty(id, undefined));
  });
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const propertyRepository = {
  subscribe(
    role: AuthRole,
    propertyIds: string[],
    callback: (properties: PropertySummary[]) => void,
  ): Unsubscribe {
    if (role === "admin") {
      return onSnapshot(collection(db, "properties"), (snapshot) => {
        callback(withKnownProperties(snapshot.docs.map((document) => toProperty(document.id, document.data())), propertyIds));
      });
    }

    if (propertyIds.length === 0) {
      callback([]);
      return () => undefined;
    }

    const properties = new Map(propertyIds.map((id) => [id, toProperty(id, undefined)]));
    const emit = () => callback([...properties.values()].sort((a, b) => a.name.localeCompare(b.name)));
    const unsubscribes = propertyIds.map((id) =>
      onSnapshot(doc(db, "properties", id), (snapshot) => {
        properties.set(id, toProperty(id, snapshot.exists() ? snapshot.data() : undefined));
        emit();
      }),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  },
};
