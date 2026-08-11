import { useCallback, useEffect, useState } from "react";
import { billingRepository } from "@/data/repositories/billingRepository";
import { useActivePropertyId } from "@/property";
import type { BillingRecord, CreateBillingInput, UpdateBillingInput } from "@/types/billing";

export function useBillingRecords() {
  const propertyId = useActivePropertyId();
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

  const reissueBilling = useCallback(
    (id: string) => billingRepository.reissue(propertyId, id),
    [propertyId],
  );

  const markInvoicePaid = useCallback(
    (id: string, invoiceId: string) => billingRepository.markInvoicePaid(propertyId, id, invoiceId),
    [propertyId],
  );

  const deleteBilling = useCallback((id: string) => billingRepository.delete(propertyId, id), [propertyId]);

  return { records, isLoading, createBilling, updateBilling, reissueBilling, markInvoicePaid, deleteBilling };
}
