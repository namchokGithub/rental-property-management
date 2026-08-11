export type BillingStatus = "draft" | "issued" | "paid" | "overdue";
export type InvoiceStatus = "issued" | "paid" | "superseded";

export interface BillingCharge {
  id: string;
  masterId?: string;
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
  otherCharges: BillingCharge[];
  subtotal: number;
  total: number;
  status: BillingStatus;
  issuedAt?: string;
  invoices?: InvoiceSnapshot[];
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSnapshot {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issuedAt: string;
  roomId: string;
  tenantId?: string;
  billingMonth: string;
  electricity: MeterReading;
  water: MeterReading;
  rentAmount: number;
  otherCharges: BillingCharge[];
  subtotal: number;
  total: number;
  dueDate?: string;
}

export interface InvoiceRecord extends InvoiceSnapshot {
  billingId: string;
}

/** Makes pre-history invoices available alongside newly reissued invoices. */
export function invoiceRecordsFromBilling(record: BillingRecord): InvoiceRecord[] {
  if (record.invoices?.length) {
    return record.invoices.map((invoice) => ({ ...invoice, billingId: record.id }));
  }
  if (!record.invoiceNumber || !record.issuedAt || record.status === "draft") return [];
  return [{
    id: record.id,
    billingId: record.id,
    invoiceNumber: record.invoiceNumber,
    status: record.status === "paid" ? "paid" : "issued",
    issuedAt: record.issuedAt,
    roomId: record.roomId,
    tenantId: record.tenantId,
    billingMonth: record.billingMonth,
    electricity: record.electricity,
    water: record.water,
    rentAmount: record.rentAmount,
    otherCharges: record.otherCharges,
    subtotal: record.subtotal,
    total: record.total,
    dueDate: record.dueDate,
  }];
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
  otherCharges: Omit<BillingCharge, "id">[];
  dueDate?: string;
  status?: BillingStatus;
}

export type UpdateBillingInput = Partial<CreateBillingInput> & { status?: BillingStatus };
