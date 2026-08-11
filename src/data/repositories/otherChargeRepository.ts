import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CreateOtherChargeInput, OtherChargeMaster, UpdateOtherChargeInput } from "@/types/otherCharge";

function settingsRef(propertyId: string) {
  return doc(db, "properties", propertyId, "settings", "general");
}

async function withMasters(
  propertyId: string,
  mutate: (masters: OtherChargeMaster[]) => OtherChargeMaster[],
): Promise<OtherChargeMaster[]> {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(settingsRef(propertyId));
    const current = (snapshot.data()?.otherChargeMasters ?? []) as OtherChargeMaster[];
    const next = mutate(current);
    transaction.set(settingsRef(propertyId), { otherChargeMasters: next }, { merge: true });
    return next;
  });
}

export const otherChargeRepository = {
  async create(propertyId: string, input: CreateOtherChargeInput): Promise<OtherChargeMaster> {
    const now = new Date().toISOString();
    const created: OtherChargeMaster = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now };
    await withMasters(propertyId, (masters) => [...masters, created]);
    return created;
  },

  async update(propertyId: string, id: string, input: UpdateOtherChargeInput): Promise<OtherChargeMaster> {
    const now = new Date().toISOString();
    let updated: OtherChargeMaster | undefined;
    await withMasters(propertyId, (masters) =>
      masters.map((master) => {
        if (master.id !== id) return master;
        updated = { ...master, ...input, updatedAt: now };
        return updated;
      }),
    );
    if (!updated) throw new Error(`OtherChargeMaster ${id} not found`);
    return updated;
  },

  async delete(propertyId: string, id: string): Promise<void> {
    await withMasters(propertyId, (masters) => masters.filter((master) => master.id !== id));
  },

  async getActive(propertyId: string): Promise<OtherChargeMaster[]> {
    const snapshot = await getDoc(settingsRef(propertyId));
    const masters = (snapshot.data()?.otherChargeMasters ?? []) as OtherChargeMaster[];
    return masters.filter((master) => master.isActive);
  },
};
