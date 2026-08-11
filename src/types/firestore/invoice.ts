import type { BillingRecord, BillingStatus } from "@/types/firestore/billing";
import type { FirestoreTimestamp } from "@/types/firestore/timestamp";

/**
 * Read model for invoice views. It is derived from invoice snapshots embedded
 * in one BillingRecord, so reissues retain their own immutable presentation.
 */
export interface InvoiceProjection {
  id: string;
  propertyId: string;
  billingId: string;
  invoiceNumber: string;
  roomId: string;
  tenantId?: string;
  billingMonth: string;
  issuedAt: FirestoreTimestamp;
  dueDate?: FirestoreTimestamp;
  total: number;
  status: Exclude<BillingStatus, "draft">;
}

export function toInvoiceProjection(record: BillingRecord): InvoiceProjection | undefined {
  if (!record.invoiceNumber || !record.issuedAt || record.status === "draft") return undefined;
  return {
    id: record.id,
    propertyId: record.propertyId,
    billingId: record.id,
    invoiceNumber: record.invoiceNumber,
    roomId: record.roomId,
    tenantId: record.tenantId,
    billingMonth: record.billingMonth,
    issuedAt: record.issuedAt,
    dueDate: record.dueDate,
    total: record.total,
    status: record.status,
  };
}
