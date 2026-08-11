import { useCallback } from "react";
import { useSettings } from "@/hooks/useSettings";
import { otherChargeRepository } from "@/data/repositories/otherChargeRepository";
import { useActivePropertyId } from "@/property";
import type { CreateOtherChargeInput, UpdateOtherChargeInput } from "@/types/otherCharge";

/**
 * Other-charge-masters live embedded on the same `properties/{id}/settings/general`
 * document as `PropertySettings` (Decision B). Reusing `useSettings()`'s
 * subscription here means this hook needs no `onSnapshot` of its own — one
 * document listener already covers both.
 */
export function useOtherCharges() {
  const propertyId = useActivePropertyId();
  const { settings, isLoading } = useSettings();
  const otherCharges = settings?.otherChargeMasters ?? [];

  const createOtherCharge = useCallback(
    (input: CreateOtherChargeInput) => otherChargeRepository.create(propertyId, input),
    [propertyId],
  );

  const updateOtherCharge = useCallback(
    (id: string, input: UpdateOtherChargeInput) => otherChargeRepository.update(propertyId, id, input),
    [propertyId],
  );

  const deleteOtherCharge = useCallback(
    (id: string) => otherChargeRepository.delete(propertyId, id),
    [propertyId],
  );

  return { otherCharges, isLoading, createOtherCharge, updateOtherCharge, deleteOtherCharge };
}
