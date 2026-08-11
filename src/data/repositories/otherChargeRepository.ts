import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import type { OtherChargeMaster, CreateOtherChargeInput, UpdateOtherChargeInput } from "@/types/otherCharge";

function all(): OtherChargeMaster[] {
  return readCollection<OtherChargeMaster>(STORAGE_KEYS.otherCharges);
}

export const otherChargeRepository = {
  getAll(): OtherChargeMaster[] {
    return all();
  },
  getActive(): OtherChargeMaster[] {
    return all().filter((c) => c.isActive);
  },
  getById(id: string): OtherChargeMaster | undefined {
    return all().find((c) => c.id === id);
  },
  create(input: CreateOtherChargeInput): OtherChargeMaster {
    const now = new Date().toISOString();
    const charge: OtherChargeMaster = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    writeCollection(STORAGE_KEYS.otherCharges, [...all(), charge]);
    return charge;
  },
  update(id: string, input: UpdateOtherChargeInput): OtherChargeMaster {
    const charges = all();
    const index = charges.findIndex((c) => c.id === id);
    if (index === -1) throw new Error(`Other charge ${id} not found`);
    const updated: OtherChargeMaster = { ...charges[index], ...input, updatedAt: new Date().toISOString() };
    charges[index] = updated;
    writeCollection(STORAGE_KEYS.otherCharges, charges);
    return updated;
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.otherCharges, all().filter((c) => c.id !== id));
  },
};
