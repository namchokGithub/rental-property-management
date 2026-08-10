import { useCallback, useState } from "react";
import { billingRepository } from "@/data/repositories/billingRepository";
import type { BillingRecord, CreateBillingInput, UpdateBillingInput } from "@/types/billing";

export function useBillingRecords() {
  const [records, setRecords] = useState<BillingRecord[]>(() => billingRepository.getAll());

  const refresh = useCallback(() => setRecords(billingRepository.getAll()), []);

  const createBilling = useCallback(
    (input: CreateBillingInput) => {
      const record = billingRepository.create(input);
      refresh();
      return record;
    },
    [refresh]
  );

  const updateBilling = useCallback(
    (id: string, input: UpdateBillingInput) => {
      const record = billingRepository.update(id, input);
      refresh();
      return record;
    },
    [refresh]
  );

  const deleteBilling = useCallback(
    (id: string) => {
      billingRepository.delete(id);
      refresh();
    },
    [refresh]
  );

  return { records, refresh, createBilling, updateBilling, deleteBilling };
}
