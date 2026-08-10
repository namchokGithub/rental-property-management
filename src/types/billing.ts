export type BillingStatus = "draft" | "issued" | "paid" | "overdue";

export interface BillingCharge {
  id: string;
  name: string;
  amount: number;
}

export interface MeterReading {
  previousMeter: number;
  currentMeter: number;
  usage: number;
  rate: number;
  amount: number;
}

export interface BillingRecord {
  id: string;
  roomId: string;
  tenantId?: string;
  invoiceNumber?: string;
  billingMonth: string; // "YYYY-MM"
  electricity: MeterReading;
  water: MeterReading;
  rentAmount: number;
  garbageFee: number;
  electricityMeterMaintenanceFee: number;
  waterMeterMaintenanceFee: number;
  otherCharges: BillingCharge[];
  subtotal: number;
  total: number;
  status: BillingStatus;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillingInput {
  roomId: string;
  tenantId?: string;
  billingMonth: string;
  electricityPreviousMeter: number;
  electricityCurrentMeter: number;
  electricityRate: number;
  waterPreviousMeter: number;
  waterCurrentMeter: number;
  waterRate: number;
  rentAmount: number;
  garbageFee: number;
  electricityMeterMaintenanceFee: number;
  waterMeterMaintenanceFee: number;
  otherCharges: Omit<BillingCharge, "id">[];
  dueDate?: string;
  status?: BillingStatus;
}

export type UpdateBillingInput = Partial<CreateBillingInput> & { status?: BillingStatus };
