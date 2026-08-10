import type { BillingRecord, BillingStatus } from "@/types/billing";
import { isPastDue } from "@/lib/date";

export function generateInvoiceNumber(billingMonth: string, existing: BillingRecord[]): string {
  const [year, month] = billingMonth.split("-");
  const prefix = `INV-${year}-${month}-`;
  const maxSeq = existing
    .filter((r) => r.invoiceNumber?.startsWith(prefix))
    .map((r) => Number(r.invoiceNumber!.slice(prefix.length)))
    .reduce((max, n) => (Number.isFinite(n) && n > max ? n : max), 0);
  const next = maxSeq + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function resolveBillingStatus(record: Pick<BillingRecord, "status" | "dueDate">): BillingStatus {
  if (record.status === "issued" && isPastDue(record.dueDate)) return "overdue";
  return record.status;
}
