import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import type { Tenant } from "@/types/tenant";

interface LegacyTenantFields {
  firstName?: string;
  lastName?: string;
}

export function runTenantNameMigration(): void {
  const rawTenants = readCollection<Tenant & LegacyTenantFields>(STORAGE_KEYS.tenants);
  let changed = false;

  const migrated = rawTenants.map((tenant) => {
    if (tenant.firstName === undefined && tenant.lastName === undefined) return tenant;

    changed = true;
    const { firstName, lastName, ...rest } = tenant;
    const name = tenant.name ?? `${firstName ?? ""} ${lastName ?? ""}`.trim();
    return { ...rest, name };
  });

  if (changed) writeCollection(STORAGE_KEYS.tenants, migrated);
}
