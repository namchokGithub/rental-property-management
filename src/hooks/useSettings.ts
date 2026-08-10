import { useCallback, useState } from "react";
import { settingsRepository } from "@/data/repositories/settingsRepository";
import type { PropertySettings } from "@/types/settings";

export function useSettings() {
  const [settings, setSettings] = useState<PropertySettings>(() => settingsRepository.get());

  const updateSettings = useCallback((input: Partial<PropertySettings>) => {
    const updated = settingsRepository.update(input);
    setSettings(updated);
    return updated;
  }, []);

  return { settings, updateSettings };
}
