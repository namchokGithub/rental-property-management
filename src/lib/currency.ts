import type { Language } from "@/i18n/types";

export function formatCurrency(amount: number, language: Language): string {
  if (language === "en") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "THB",
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
