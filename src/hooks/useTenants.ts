import { useCallback, useState } from "react";
import { tenantRepository } from "@/data/repositories/tenantRepository";
import type { Tenant, CreateTenantInput, UpdateTenantInput } from "@/types/tenant";

export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>(() => tenantRepository.getAll());

  const refresh = useCallback(() => setTenants(tenantRepository.getAll()), []);

  const createTenant = useCallback(
    (input: CreateTenantInput) => {
      const tenant = tenantRepository.create(input);
      refresh();
      return tenant;
    },
    [refresh]
  );

  const updateTenant = useCallback(
    (id: string, input: UpdateTenantInput) => {
      const tenant = tenantRepository.update(id, input);
      refresh();
      return tenant;
    },
    [refresh]
  );

  const deleteTenant = useCallback(
    (id: string) => {
      tenantRepository.delete(id);
      refresh();
    },
    [refresh]
  );

  return { tenants, refresh, createTenant, updateTenant, deleteTenant };
}
