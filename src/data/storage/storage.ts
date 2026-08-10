const PREFIX = "rental.";

export function readCollection<T>(key: string): T[] {
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function writeCollection<T>(key: string, items: T[]): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(items));
}

export function readValue<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeValue<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export const STORAGE_KEYS = {
  rooms: "rooms",
  tenants: "tenants",
  assignments: "assignments",
  billing: "billing",
  settings: "settings",
} as const;
