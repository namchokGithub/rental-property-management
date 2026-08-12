import { useNavigate } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  DoorOpen,
  CheckCircle2,
  Users,
  Wallet,
  AlertCircle,
  Building2,
  Receipt,
  Plus,
  UserPlus,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/auth";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import { formatBillingMonth } from "@/lib/date";
import { latestInvoiceFromBilling, resolveBillingStatus } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { RoomStatus } from "@/types/room";

const ROOM_STATUS_ORDER: RoomStatus[] = [
  "occupied",
  "available",
  "maintenance",
  "inactive",
];

type SummaryVariant = "primary" | "blue" | "purple" | "coral" | "plain";

// Colors come from the active theme's tokens (see src/index.css) — never hardcoded here,
// so summary cards automatically follow whichever accent theme / appearance is selected.
const SUMMARY_VARIANT_STYLES: Record<SummaryVariant, string> = {
  primary: "bg-primary text-primary-foreground",
  blue: "bg-accent-2 text-accent-2-foreground",
  purple: "bg-accent-3 text-accent-3-foreground",
  coral: "bg-accent-4 text-accent-4-foreground",
  plain: "bg-card text-foreground",
};

interface SummaryCard {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant: SummaryVariant;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { rooms } = useRooms();
  const { tenants } = useTenants();
  const { records } = useBillingRecords();

  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const available = rooms.filter((r) => r.status === "available").length;
  const activeTenants = tenants.filter(
    (tenant) => tenant.status === "active",
  ).length;
  const estimatedIncome = rooms
    .filter((r) => r.status === "occupied")
    .reduce((sum, r) => sum + r.monthlyRent, 0);
  const outstandingInvoices = records.filter((r) => {
    const status = resolveBillingStatus(r);
    return status === "issued" || status === "overdue";
  }).length;

  const summaryCards: SummaryCard[] = [
    {
      label: t("dashboard.totalRooms"),
      value: rooms.length,
      icon: Building2,
      variant: "primary",
    },
    {
      label: t("dashboard.occupied"),
      value: occupied,
      icon: DoorOpen,
      variant: "blue",
    },
    {
      label: t("dashboard.available"),
      value: available,
      icon: CheckCircle2,
      variant: "purple",
    },
    {
      label: t("dashboard.totalTenants"),
      value: activeTenants,
      icon: Users,
      variant: "plain",
    },
    {
      label: t("dashboard.estMonthlyIncome"),
      value: formatCurrency(estimatedIncome, language),
      icon: Wallet,
      variant: "plain",
    },
    {
      label: t("dashboard.outstandingInvoices"),
      value: outstandingInvoices,
      icon: AlertCircle,
      variant: "coral",
    },
  ];

  const recentRecords = [...records]
    .sort(
      (a, b) =>
        b.billingMonth.localeCompare(a.billingMonth) ||
        (latestInvoiceFromBilling(b)?.issuedAt ?? b.createdAt).localeCompare(
          latestInvoiceFromBilling(a)?.issuedAt ?? a.createdAt,
        ),
    )
    .slice(0, 5);

  const roomsByStatus = ROOM_STATUS_ORDER.map((status) => ({
    status,
    count: rooms.filter((r) => r.status === status).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <Card
            key={card.label}
            className={cn(
              "border-none shadow-sm",
              SUMMARY_VARIANT_STYLES[card.variant],
            )}>
            <CardContent className="flex items-center gap-3 p-4">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  card.variant === "plain"
                    ? "bg-accent text-primary"
                    : "bg-black/10",
                )}>
                <card.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium opacity-80">
                  {card.label}
                </p>
                <p className="truncate text-xl font-semibold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard.roomStatusOverview")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {roomsByStatus.map(({ status, count }) => {
              const pct =
                rooms.length > 0 ? Math.round((count / rooms.length) * 100) : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <StatusBadge status={status} />
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard.recentBilling")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRecords.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={t("dashboard.noBillingTitle")}
                description={t("dashboard.noBillingDescription")}
                actionLabel={isAdmin ? t("dashboard.createBilling") : undefined}
                onAction={isAdmin ? () => navigate("/billing") : undefined}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.room")}</TableHead>
                    <TableHead>{t("common.tenant")}</TableHead>
                    <TableHead>{t("common.month")}</TableHead>
                    <TableHead>{t("common.amount")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRecords.map((record) => {
                    const room = rooms.find((r) => r.id === record.roomId);
                    const tenant = tenants.find(
                      (tenantItem) => tenantItem.id === record.tenantId,
                    );
                    const latestInvoice = latestInvoiceFromBilling(record);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>{room?.roomNumber ?? "—"}</TableCell>
                        <TableCell>{tenant ? tenant.name : "—"}</TableCell>
                        <TableCell>
                          {formatBillingMonth(record.billingMonth, language)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(
                            latestInvoice?.total ?? record.total,
                            language,
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={resolveBillingStatus(record)} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("dashboard.quickActions")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Button onClick={() => navigate("/rooms")}>
                <Plus /> {t("dashboard.addRoom")}
              </Button>
              <Button variant="outline" onClick={() => navigate("/tenants")}>
                <UserPlus /> {t("dashboard.addTenant")}
              </Button>
              <Button variant="outline" onClick={() => navigate("/billing")}>
                <Receipt /> {t("dashboard.createBilling")}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => navigate("/invoices")}>
            <FileText /> {t("dashboard.viewInvoices")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
