import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import { calculateMeterReading, calculateBillingTotals } from "@/lib/calculations";
import { generateInvoiceNumber } from "@/lib/invoice";
import type { BillingRecord, CreateBillingInput, UpdateBillingInput, BillingCharge } from "@/types/billing";

function all(): BillingRecord[] {
  return readCollection<BillingRecord>(STORAGE_KEYS.billing);
}

function buildCharges(input: Omit<BillingCharge, "id">[]): BillingCharge[] {
  return input.map((c) => ({ ...c, id: crypto.randomUUID() }));
}

function computeRecord(input: CreateBillingInput, id: string, now: string): BillingRecord {
  const electricity = calculateMeterReading(input.electricityPreviousMeter, input.electricityCurrentMeter, input.electricityRate);
  const water = calculateMeterReading(input.waterPreviousMeter, input.waterCurrentMeter, input.waterRate);
  const otherCharges = buildCharges(input.otherCharges);
  const totals = calculateBillingTotals({
    electricityAmount: electricity.amount,
    waterAmount: water.amount,
    rentAmount: input.rentAmount,
    otherCharges,
  });
  const status = input.status ?? "draft";
  return {
    id,
    roomId: input.roomId,
    tenantId: input.tenantId,
    billingMonth: input.billingMonth,
    electricity,
    water,
    rentAmount: input.rentAmount,
    otherCharges,
    subtotal: totals.subtotal,
    total: totals.total,
    status,
    invoiceNumber: status === "issued" ? generateInvoiceNumber(input.billingMonth, all()) : undefined,
    issuedAt: status === "issued" ? now : undefined,
    dueDate: input.dueDate,
    createdAt: now,
    updatedAt: now,
  };
}

export const billingRepository = {
  getAll(): BillingRecord[] {
    return all();
  },
  getById(id: string): BillingRecord | undefined {
    return all().find((b) => b.id === id);
  },
  getByRoomId(roomId: string): BillingRecord[] {
    return all().filter((b) => b.roomId === roomId);
  },
  create(input: CreateBillingInput): BillingRecord {
    const now = new Date().toISOString();
    const record = computeRecord(input, crypto.randomUUID(), now);
    writeCollection(STORAGE_KEYS.billing, [...all(), record]);
    return record;
  },
  update(id: string, input: UpdateBillingInput): BillingRecord {
    const records = all();
    const index = records.findIndex((b) => b.id === id);
    if (index === -1) throw new Error(`Billing record ${id} not found`);
    const existing = records[index];
    const merged: CreateBillingInput = {
      roomId: input.roomId ?? existing.roomId,
      tenantId: input.tenantId ?? existing.tenantId,
      billingMonth: input.billingMonth ?? existing.billingMonth,
      electricityPreviousMeter: input.electricityPreviousMeter ?? existing.electricity.previousMeter,
      electricityCurrentMeter: input.electricityCurrentMeter ?? existing.electricity.currentMeter,
      electricityRate: input.electricityRate ?? existing.electricity.rate,
      waterPreviousMeter: input.waterPreviousMeter ?? existing.water.previousMeter,
      waterCurrentMeter: input.waterCurrentMeter ?? existing.water.currentMeter,
      waterRate: input.waterRate ?? existing.water.rate,
      rentAmount: input.rentAmount ?? existing.rentAmount,
      otherCharges: input.otherCharges ?? existing.otherCharges,
      dueDate: input.dueDate ?? existing.dueDate,
      status: input.status ?? existing.status,
    };
    const recomputed = computeRecord(merged, existing.id, existing.createdAt);
    const wasIssuedNow = existing.status !== "issued" && recomputed.status === "issued";
    const updated: BillingRecord = {
      ...recomputed,
      invoiceNumber: wasIssuedNow
        ? generateInvoiceNumber(merged.billingMonth, all().filter((b) => b.id !== id))
        : (existing.invoiceNumber ?? recomputed.invoiceNumber),
      issuedAt: wasIssuedNow ? new Date().toISOString() : existing.issuedAt,
      paidAt: recomputed.status === "paid" ? (existing.paidAt ?? new Date().toISOString()) : existing.paidAt,
      updatedAt: new Date().toISOString(),
    };
    records[index] = updated;
    writeCollection(STORAGE_KEYS.billing, records);
    return updated;
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.billing, all().filter((b) => b.id !== id));
  },
};
