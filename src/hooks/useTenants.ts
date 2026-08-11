import { useCallback, useEffect, useState } from "react";
import { tenantRepository } from "@/data/repositories/tenantRepository";
import { useActivePropertyId } from "@/property";
import type { Tenant, CreateTenantInput, UpdateTenantInput } from "@/types/tenant";

export function useTenants() {
  const propertyId = useActivePropertyId();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = tenantRepository.subscribe(propertyId, (next) => {
      setTenants(next);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [propertyId]);

  const createTenant = useCallback(
    (input: CreateTenantInput) => tenantRepository.create(propertyId, input),
    [propertyId],
  );

  const updateTenant = useCallback(
    (id: string, input: UpdateTenantInput) => tenantRepository.update(propertyId, id, input),
    [propertyId],
  );

  const deleteTenant = useCallback((id: string) => tenantRepository.delete(propertyId, id), [propertyId]);

  return { tenants, isLoading, createTenant, updateTenant, deleteTenant };
}
