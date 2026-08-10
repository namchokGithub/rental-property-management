import type { BillingCharge, MeterReading } from "@/types/billing";

export function calculateUsage(previousMeter: number, currentMeter: number): number {
  return Math.max(0, currentMeter - previousMeter);
}

export function calculateMeterReading(
  previousMeter: number,
  currentMeter: number,
  rate: number
): MeterReading {
  const usage = calculateUsage(previousMeter, currentMeter);
  return { previousMeter, currentMeter, usage, rate, amount: usage * rate };
}

export interface BillingTotals {
  subtotal: number;
  total: number;
}

export function calculateBillingTotals(params: {
  electricityAmount: number;
  waterAmount: number;
  rentAmount: number;
  garbageFee: number;
  electricityMeterMaintenanceFee: number;
  waterMeterMaintenanceFee: number;
  otherCharges: Pick<BillingCharge, "amount">[];
}): BillingTotals {
  const subtotal =
    params.electricityAmount +
    params.waterAmount +
    params.rentAmount +
    params.garbageFee +
    params.electricityMeterMaintenanceFee +
    params.waterMeterMaintenanceFee;
  const otherTotal = params.otherCharges.reduce((sum, c) => sum + c.amount, 0);
  return { subtotal, total: subtotal + otherTotal };
}
