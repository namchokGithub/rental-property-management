import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import type { Tenant, CreateTenantInput, UpdateTenantInput } from "@/types/tenant";

function all(): Tenant[] {
  return readCollection<Tenant>(STORAGE_KEYS.tenants);
}

export const tenantRepository = {
  getAll(): Tenant[] {
    return all();
  },
  getById(id: string): Tenant | undefined {
    return all().find((t) => t.id === id);
  },
  create(input: CreateTenantInput): Tenant {
    const now = new Date().toISOString();
    const tenant: Tenant = { ...input, status: input.status ?? "active", id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    writeCollection(STORAGE_KEYS.tenants, [...all(), tenant]);
    return tenant;
  },
  update(id: string, input: UpdateTenantInput): Tenant {
    const tenants = all();
    const index = tenants.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`Tenant ${id} not found`);
    const updated: Tenant = { ...tenants[index], ...input, updatedAt: new Date().toISOString() };
    tenants[index] = updated;
    writeCollection(STORAGE_KEYS.tenants, tenants);
    return updated;
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.tenants, all().filter((t) => t.id !== id));
  },
};
