import type { FirestoreTimestamp } from "@/types/firestore/timestamp";

export type BillingStatus = "draft" | "issued" | "paid" | "overdue";

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
  propertyId: string;
  roomId: string;
  tenantId?: string;
  billingMonth: string;
  roomSnapshot: {
    roomNumber: string;
    monthlyRent: number;
  };
  tenantSnapshot?: {
    fullName: string;
  };
  electricity: MeterReading;
  water: MeterReading;
  rentAmount: number;
  otherCharges: BillingCharge[];
  subtotal: number;
  total: number;
  status: BillingStatus;
  invoiceNumber?: string;
  dueDate?: FirestoreTimestamp;
  issuedAt?: FirestoreTimestamp;
  paidAt?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
