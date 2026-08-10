import type { Language } from "@/i18n/types";

function toLocale(language: Language): string {
  return language === "en" ? "en-US" : "th-TH";
}

export function formatDate(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(toLocale(language), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatBillingMonth(billingMonth: string, language: Language): string {
  const [year, month] = billingMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(toLocale(language), {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function isPastDue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}
