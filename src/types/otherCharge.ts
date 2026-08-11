export interface OtherChargeMaster {
  id: string;
  nameTh: string;
  nameEn?: string;
  defaultAmount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateOtherChargeInput = Omit<OtherChargeMaster, "id" | "createdAt" | "updatedAt">;
export type UpdateOtherChargeInput = Partial<CreateOtherChargeInput>;
