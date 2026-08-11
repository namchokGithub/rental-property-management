import type { OtherChargeMaster } from "@/types/otherCharge";

export interface PropertySettings {
  propertyName: string;
  propertyAddress: string;
  phone: string;
  defaultElectricityRate: number;
  defaultWaterRate: number;
  defaultInvoiceNote: string;
  /**
   * Other-charge-master records embedded on this same settings document
   * (Decision B: no separate collection, since edits are rare and admin-only).
   */
  otherChargeMasters?: OtherChargeMaster[];
}
