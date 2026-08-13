import type { Language } from "@/i18n/types";

export function formatAmount(amount: number, language: Language): string {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrency(amount: number, language: Language): string {
  return formatAmount(amount, language);
}
