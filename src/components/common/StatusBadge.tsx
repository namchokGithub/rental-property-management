import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import type { RoomStatus } from "@/types/room";
import type { TenantStatus } from "@/types/tenant";
import type { BillingStatus } from "@/types/billing";
import type { AssignmentStatus } from "@/types/assignment";

type Status = RoomStatus | TenantStatus | BillingStatus | AssignmentStatus;

const STYLES: Record<Status, string> = {
  available: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  occupied: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  maintenance: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  inactive: "bg-slate-100 text-slate-600 hover:bg-slate-100",
  active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  draft: "bg-slate-100 text-slate-600 hover:bg-slate-100",
  issued: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  paid: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  overdue: "bg-red-100 text-red-800 hover:bg-red-100",
  ended: "bg-slate-100 text-slate-600 hover:bg-slate-100",
};

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useLanguage();
  return <Badge className={cn("border-none font-medium", STYLES[status])}>{t(`status.${status}`)}</Badge>;
}
