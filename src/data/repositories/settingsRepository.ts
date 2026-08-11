import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PropertySettings } from "@/types/settings";

const DEFAULTS: PropertySettings = {
  propertyName: "",
  propertyAddress: "",
  phone: "",
  defaultElectricityRate: 0,
  defaultWaterRate: 0,
  defaultInvoiceNote: "",
};

function settingsRef(propertyId: string) {
  return doc(db, "properties", propertyId, "settings", "general");
}

function propertyRef(propertyId: string) {
  return doc(db, "properties", propertyId);
}

export const settingsRepository = {
  async get(propertyId: string): Promise<PropertySettings> {
    const snapshot = await getDoc(settingsRef(propertyId));
    return snapshot.exists() ? (snapshot.data() as PropertySettings) : DEFAULTS;
  },

  async update(propertyId: string, input: Partial<PropertySettings>): Promise<PropertySettings> {
    await setDoc(settingsRef(propertyId), input, { merge: true });
    const parentRef = propertyRef(propertyId);
    const parentSnapshot = await getDoc(parentRef);
    await setDoc(
      parentRef,
      {
        name: input.propertyName?.trim() || propertyId,
        ...(input.propertyAddress !== undefined ? { address: input.propertyAddress } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(parentSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return settingsRepository.get(propertyId);
  },

  subscribe(propertyId: string, callback: (settings: PropertySettings) => void): Unsubscribe {
    return onSnapshot(settingsRef(propertyId), (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as PropertySettings) : DEFAULTS);
    });
  },
};
