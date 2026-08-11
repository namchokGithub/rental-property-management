import { readRaw, readCollection, writeCollection, writeValue, STORAGE_KEYS } from "@/data/storage/storage";
import { otherChargeRepository } from "@/data/repositories/otherChargeRepository";
import { calculateBillingTotals } from "@/lib/calculations";
import type { BillingRecord, BillingCharge } from "@/types/billing";
import type { PropertySettings } from "@/types/settings";

interface LegacySettingsFields {
  defaultGarbageFee?: number;
  defaultElectricityMeterMaintenanceFee?: number;
  defaultWaterMeterMaintenanceFee?: number;
}

interface LegacyBillingFields {
  garbageFee?: number;
  electricityMeterMaintenanceFee?: number;
  waterMeterMaintenanceFee?: number;
}

function readLegacySettings(): LegacySettingsFields {
  const raw = readRaw(STORAGE_KEYS.settings);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as LegacySettingsFields;
  } catch {
    return {};
  }
}

function seedOtherChargeMasters(): void {
  if (otherChargeRepository.getAll().length > 0) return;

  const legacy = readLegacySettings();
  const garbageFee = legacy.defaultGarbageFee ?? 50;
  const electricityMaintenanceFee = legacy.defaultElectricityMeterMaintenanceFee ?? 30;
  const waterMaintenanceFee = legacy.defaultWaterMeterMaintenanceFee ?? 30;

  otherChargeRepository.create({ nameTh: "ค่าขยะ", nameEn: "Garbage Fee", defaultAmount: garbageFee, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าบำรุงรักษามิเตอร์ไฟฟ้า", nameEn: "Electricity Meter Maintenance", defaultAmount: electricityMaintenanceFee, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าบำรุงรักษามิเตอร์น้ำ", nameEn: "Water Meter Maintenance", defaultAmount: waterMaintenanceFee, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าทำความสะอาด", nameEn: "Cleaning Fee", defaultAmount: 100, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าที่จอดรถ", nameEn: "Parking Fee", defaultAmount: 300, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าอินเทอร์เน็ต", nameEn: "Internet Fee", defaultAmount: 200, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าใช้จ่ายอื่น ๆ", nameEn: "Other Fee", defaultAmount: 0, isActive: true });
}

function migrateLegacyBillingRecords(): void {
  const masters = otherChargeRepository.getAll();
  const masterIdByNameTh = new Map(masters.map((m) => [m.nameTh, m.id] as const));
  const garbageMasterId = masterIdByNameTh.get("ค่าขยะ");
  const electricityMaintenanceMasterId = masterIdByNameTh.get("ค่าบำรุงรักษามิเตอร์ไฟฟ้า");
  const waterMaintenanceMasterId = masterIdByNameTh.get("ค่าบำรุงรักษามิเตอร์น้ำ");

  const rawRecords = readCollection<BillingRecord & LegacyBillingFields>(STORAGE_KEYS.billing);
  let changed = false;

  const migrated = rawRecords.map((record) => {
    const hasLegacyFields =
      record.garbageFee !== undefined ||
      record.electricityMeterMaintenanceFee !== undefined ||
      record.waterMeterMaintenanceFee !== undefined;
    if (!hasLegacyFields) return record;

    changed = true;
    const extraCharges: BillingCharge[] = [];
    if (record.garbageFee && record.garbageFee > 0) {
      extraCharges.push({ id: crypto.randomUUID(), masterId: garbageMasterId, name: "ค่าขยะ", amount: record.garbageFee });
    }
    if (record.electricityMeterMaintenanceFee && record.electricityMeterMaintenanceFee > 0) {
      extraCharges.push({
        id: crypto.randomUUID(),
        masterId: electricityMaintenanceMasterId,
        name: "ค่าบำรุงรักษามิเตอร์ไฟฟ้า",
        amount: record.electricityMeterMaintenanceFee,
      });
    }
    if (record.waterMeterMaintenanceFee && record.waterMeterMaintenanceFee > 0) {
      extraCharges.push({
        id: crypto.randomUUID(),
        masterId: waterMaintenanceMasterId,
        name: "ค่าบำรุงรักษามิเตอร์น้ำ",
        amount: record.waterMeterMaintenanceFee,
      });
    }

    const otherCharges = [...record.otherCharges, ...extraCharges];
    const totals = calculateBillingTotals({
      electricityAmount: record.electricity.amount,
      waterAmount: record.water.amount,
      rentAmount: record.rentAmount,
      otherCharges,
    });

    const { garbageFee: _garbageFee, electricityMeterMaintenanceFee: _electricityMeterMaintenanceFee, waterMeterMaintenanceFee: _waterMeterMaintenanceFee, ...rest } = record;
    return { ...rest, otherCharges, subtotal: totals.subtotal, total: totals.total };
  });

  if (changed) writeCollection(STORAGE_KEYS.billing, migrated);
}

function stripLegacySettingsFields(): void {
  const raw = readRaw(STORAGE_KEYS.settings);
  if (!raw) return;
  let parsed: (PropertySettings & LegacySettingsFields) | null = null;
  try {
    parsed = JSON.parse(raw) as PropertySettings & LegacySettingsFields;
  } catch {
    return;
  }
  const hasLegacyFields =
    parsed.defaultGarbageFee !== undefined ||
    parsed.defaultElectricityMeterMaintenanceFee !== undefined ||
    parsed.defaultWaterMeterMaintenanceFee !== undefined;
  if (!hasLegacyFields) return;

  const clean: PropertySettings = {
    propertyName: parsed.propertyName,
    propertyAddress: parsed.propertyAddress,
    phone: parsed.phone,
    defaultElectricityRate: parsed.defaultElectricityRate,
    defaultWaterRate: parsed.defaultWaterRate,
    defaultInvoiceNote: parsed.defaultInvoiceNote,
  };
  writeValue(STORAGE_KEYS.settings, clean);
}

export function runLegacyChargeMigration(): void {
  seedOtherChargeMasters();
  migrateLegacyBillingRecords();
  stripLegacySettingsFields();
}
