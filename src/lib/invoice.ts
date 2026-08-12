import {
  invoiceRecordsFromBilling,
  type BillingRecord,
  type BillingStatus,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/types/billing";
import { isPastDue } from "@/lib/date";

export function generateInvoiceNumber(
  billingMonth: string,
  existing: BillingRecord[],
): string {
  const [year, month] = billingMonth.split("-");
  const prefix = `INV-${year}-${month}-`;
  const maxSeq = existing
    .filter((r) => r.invoiceNumber?.startsWith(prefix))
    .map((r) => Number(r.invoiceNumber!.slice(prefix.length)))
    .reduce((max, n) => (Number.isFinite(n) && n > max ? n : max), 0);
  const next = maxSeq + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

/** Returns the most recently issued version of a bill's invoice. */
export function latestInvoiceFromBilling(
  record: BillingRecord,
): InvoiceRecord | undefined {
  return invoiceRecordsFromBilling(record).reduce<InvoiceRecord | undefined>(
    (latest, invoice) => {
      if (!latest || invoice.issuedAt >= latest.issuedAt) return invoice;
      return latest;
    },
    undefined,
  );
}

/**
 * A bill's current status always comes from its newest invoice version. The
 * top-level status remains a fallback for draft and legacy bills with no
 * invoice history.
 */
export function resolveBillingStatus(record: BillingRecord): BillingStatus {
  const latestInvoice = latestInvoiceFromBilling(record);
  if (latestInvoice?.status === "paid") return "paid";
  if (latestInvoice?.status === "issued") {
    return isPastDue(latestInvoice.dueDate) ? "overdue" : "issued";
  }
  if (record.status === "issued" && isPastDue(record.dueDate)) return "overdue";
  return record.status;
}

export function resolveInvoiceStatus(
  record: InvoiceRecord,
): BillingStatus | InvoiceStatus {
  if (record.status !== "issued") return record.status;
  return isPastDue(record.dueDate) ? "overdue" : "issued";
}
