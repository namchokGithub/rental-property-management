import { useCallback, useState } from "react";
import { otherChargeRepository } from "@/data/repositories/otherChargeRepository";
import type { OtherChargeMaster, CreateOtherChargeInput, UpdateOtherChargeInput } from "@/types/otherCharge";

export function useOtherCharges() {
  const [otherCharges, setOtherCharges] = useState<OtherChargeMaster[]>(() => otherChargeRepository.getAll());

  const refresh = useCallback(() => setOtherCharges(otherChargeRepository.getAll()), []);

  const createOtherCharge = useCallback(
    (input: CreateOtherChargeInput) => {
      const charge = otherChargeRepository.create(input);
      refresh();
      return charge;
    },
    [refresh]
  );

  const updateOtherCharge = useCallback(
    (id: string, input: UpdateOtherChargeInput) => {
      const charge = otherChargeRepository.update(id, input);
      refresh();
      return charge;
    },
    [refresh]
  );

  const deleteOtherCharge = useCallback(
    (id: string) => {
      otherChargeRepository.delete(id);
      refresh();
    },
    [refresh]
  );

  return { otherCharges, refresh, createOtherCharge, updateOtherCharge, deleteOtherCharge };
}
