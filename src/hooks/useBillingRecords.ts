import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, type Timestamp } from "firebase/firestore";
import { useAuth } from "@/auth";
import { billingRepository } from "@/data/repositories/billingRepository";
import { timestampToIso } from "@/data/repositories/converters/timestamp";
import { db } from "@/lib/firebase";
import { getActivePropertyId } from "@/lib/activeProperty";
import type { BillingRecord, CreateBillingInput, UpdateBillingInput } from "@/types/billing";

// `dueDate`/`issuedAt`/`paidAt`/`createdAt`/`updatedAt` are written as
// Firestore `Timestamp`s (billingRepository.create/update) but `BillingRecord`
// declares all five as ISO strings (or absent) — convert on every read, same
// pattern as `useAssignments.ts`'s `toAssignment()`.
function toBillingRecord(id: string, data: Record<string, unknown>): BillingRecord {
  return {
    id,
    ...data,
    issuedAt: timestampToIso(data.issuedAt as Timestamp | null | undefined),
    dueDate: timestampToIso(data.dueDate as Timestamp | null | undefined),
    paidAt: timestampToIso(data.paidAt as Timestamp | null | undefined),
    createdAt: timestampToIso(data.createdAt as Timestamp | null | undefined) ?? new Date().toISOString(),
    updatedAt: timestampToIso(data.updatedAt as Timestamp | null | undefined) ?? new Date().toISOString(),
  } as BillingRecord;
}

export function useBillingRecords() {
  const { user } = useAuth();
  const propertyId = getActivePropertyId(user?.propertyIds ?? []);
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onSnapshot(collection(db, "properties", propertyId, "billing"), (snapshot) => {
      setRecords(snapshot.docs.map((d) => toBillingRecord(d.id, d.data())));
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
