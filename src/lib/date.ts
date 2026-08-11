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

export function monthName(month: number, language: Language): string {
  return new Intl.DateTimeFormat(toLocale(language), { month: "long" }).format(new Date(2000, month - 1, 1));
}

export function yearLabel(year: number, language: Language): string {
  return String(language === "th" ? year + 543 : year);
}

export function defaultDueDate(billingMonth: string): string {
  const [year, month] = billingMonth.split("-").map(Number);
  const nextMonth = new Date(year, month, 15);
  const mm = String(nextMonth.getMonth() + 1).padStart(2, "0");
  return `${nextMonth.getFullYear()}-${mm}-15`;
}

export function isPastDue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}
