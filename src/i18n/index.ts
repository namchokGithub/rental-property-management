import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Language, Translations, TranslationParams } from "@/i18n/types";
import en from "@/i18n/translations/en";
import th from "@/i18n/translations/th";

const STORAGE_KEY = "app.language";
const DEFAULT_LANGUAGE: Language = "th";

const DICTIONARIES: Record<Language, Translations> = { en, th };

function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "th";
}

function readStoredLanguage(): Language {
  if (typeof localStorage === "undefined") return DEFAULT_LANGUAGE;
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

function resolveTemplate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

function lookup(dictionary: Translations, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = dictionary;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: TranslationParams) => string;
}

export const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const value = lookup(DICTIONARIES[language], key);
      return resolveTemplate(value ?? key, params);
    },
    [language]
  );

  return createElement(LanguageContext.Provider, { value: { language, setLanguage, t } }, children);
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}

export type { Language, Translations, TranslationParams } from "@/i18n/types";
