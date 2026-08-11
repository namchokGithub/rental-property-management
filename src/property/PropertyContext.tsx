import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/auth";
import { propertyRepository } from "@/data/repositories/propertyRepository";
import type { PropertySummary } from "@/types/property";

interface PropertyContextValue {
  properties: PropertySummary[];
  activePropertyId: string | null;
  setActivePropertyId: (propertyId: string) => void;
  isLoading: boolean;
}

const PropertyContext = createContext<PropertyContextValue | null>(null);

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProperties([]);
      setActivePropertyId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    return propertyRepository.subscribe(user.role, user.propertyIds, (next) => {
      setProperties(next);
      setActivePropertyId((current) => (current && next.some((property) => property.id === current) ? current : (next[0]?.id ?? null)));
      setIsLoading(false);
    });
  }, [user]);

  return (
    <PropertyContext.Provider value={{ properties, activePropertyId, setActivePropertyId, isLoading }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty(): PropertyContextValue {
  const context = useContext(PropertyContext);
  if (!context) throw new Error("useProperty must be used within PropertyProvider");
  return context;
}

export function useActivePropertyId(): string {
  const { activePropertyId } = useProperty();
  if (!activePropertyId) throw new Error("No active property selected");
  return activePropertyId;
}
