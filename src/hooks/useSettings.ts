import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth";
import { settingsRepository } from "@/data/repositories/settingsRepository";
import { getActivePropertyId } from "@/lib/activeProperty";
import type { PropertySettings } from "@/types/settings";

export function useSettings() {
  const { user } = useAuth();
  const propertyId = getActivePropertyId(user?.propertyIds ?? []);
  const [settings, setSettings] = useState<PropertySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = settingsRepository.subscribe(propertyId, (next) => {
      setSettings(next);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [propertyId]);

  const updateSettings = useCallback(
    (input: Partial<PropertySettings>) => settingsRepository.update(propertyId, input),
    [propertyId],
  );

  return { settings, isLoading, updateSettings };
}
