import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AccentTheme, Appearance, ResolvedAppearance } from "@/theme/theme.types";
import { readAccentTheme, readAppearance, writeAccentTheme, writeAppearance } from "@/theme/theme.storage";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_MEDIA_QUERY).matches;
}

function resolveAppearance(appearance: Appearance): ResolvedAppearance {
  if (appearance === "system") return systemPrefersDark() ? "dark" : "light";
  return appearance;
}

export interface ThemeContextValue {
  appearance: Appearance;
  accentTheme: AccentTheme;
  resolvedAppearance: ResolvedAppearance;
  setAppearance: (value: Appearance) => void;
  setAccentTheme: (value: AccentTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance);
  const [accentTheme, setAccentThemeState] = useState<AccentTheme>(readAccentTheme);
  const [resolvedAppearance, setResolvedAppearance] = useState<ResolvedAppearance>(() => resolveAppearance(appearance));

  useEffect(() => {
    setResolvedAppearance(resolveAppearance(appearance));
    if (appearance !== "system") return;

    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = () => setResolvedAppearance(resolveAppearance("system"));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [appearance]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedAppearance === "dark");
  }, [resolvedAppearance]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", accentTheme);
  }, [accentTheme]);

  const setAppearance = useCallback((value: Appearance) => {
    setAppearanceState(value);
    writeAppearance(value);
  }, []);

  const setAccentTheme = useCallback((value: AccentTheme) => {
    setAccentThemeState(value);
    writeAccentTheme(value);
  }, []);

  const value: ThemeContextValue = {
    appearance,
    accentTheme,
    resolvedAppearance,
    setAppearance,
    setAccentTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
