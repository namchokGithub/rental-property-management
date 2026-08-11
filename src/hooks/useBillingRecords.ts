import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth";
import { billingRepository } from "@/data/repositories/billingRepository";
import { getActivePropertyId } from "@/lib/activeProperty";
import type { BillingRecord, CreateBillingInput, UpdateBillingInput } from "@/types/billing";

export function useBillingRecords() {
  const { user } = useAuth();
  const propertyId = getActivePropertyId(user?.propertyIds ?? []);
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = billingRepository.subscribe(propertyId, (next) => {
      setRecords(next);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [propertyId]);

  const createBilling = useCallback(
    (input: CreateBillingInput) => billingRepository.create(propertyId, input),
    [propertyId],
  );

  const updateBilling = useCallback(
    (id: string, input: UpdateBillingInput) => billingRepository.update(propertyId, id, input),
    [propertyId],
  );

  const deleteBilling = useCallback((id: string) => billingRepository.delete(propertyId, id), [propertyId]);

  return { records, isLoading, createBilling, updateBilling, deleteBilling };
}
