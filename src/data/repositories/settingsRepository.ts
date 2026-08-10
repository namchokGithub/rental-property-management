import { readValue, writeValue, STORAGE_KEYS } from "@/data/storage/storage";
import type { PropertySettings } from "@/types/settings";

const DEFAULTS: PropertySettings = {
  propertyName: "Sunrise Apartments",
  propertyAddress: "",
  phone: "",
  defaultElectricityRate: 8,
  defaultWaterRate: 18,
  defaultGarbageFee: 50,
  defaultElectricityMeterMaintenanceFee: 30,
  defaultWaterMeterMaintenanceFee: 30,
  defaultInvoiceNote: "Please pay by the due date to avoid late fees.",
};

export const settingsRepository = {
  get(): PropertySettings {
    return readValue<PropertySettings>(STORAGE_KEYS.settings, DEFAULTS);
  },
  update(input: Partial<PropertySettings>): PropertySettings {
    const merged = { ...settingsRepository.get(), ...input };
    writeValue(STORAGE_KEYS.settings, merged);
    return merged;
  },
};
