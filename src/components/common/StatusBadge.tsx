import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import type { RoomStatus } from "@/types/room";
import type { TenantStatus } from "@/types/tenant";
import type { BillingStatus } from "@/types/billing";
import type { AssignmentStatus } from "@/types/assignment";

type Status = RoomStatus | TenantStatus | BillingStatus | AssignmentStatus;

// Deliberately literal Tailwind colors, not theme tokens — status meaning must stay
// consistent (green = good, red = attention, etc.) regardless of the selected accent theme.
const STYLES: Record<Status, string> = {
  available: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15",
  occupied: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/15",
  maintenance: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/15",
  inactive: "bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-500/15 dark:text-slate-300 dark:hover:bg-slate-500/15",
  active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15",
  draft: "bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-500/15 dark:text-slate-300 dark:hover:bg-slate-500/15",
  issued: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/15",
  paid: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15",
  overdue: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/15",
  ended: "bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-500/15 dark:text-slate-300 dark:hover:bg-slate-500/15",
};

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useLanguage();
  return <Badge className={cn("border-none font-medium", STYLES[status])}>{t(`status.${status}`)}</Badge>;
}
