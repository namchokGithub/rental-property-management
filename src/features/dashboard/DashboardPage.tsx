import { useNavigate } from "react-router";
import { DoorOpen, CheckCircle2, Users, Wallet, AlertCircle, Building2, Receipt, Plus, UserPlus, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import { formatBillingMonth } from "@/lib/date";
import { resolveBillingStatus } from "@/lib/invoice";
import type { RoomStatus } from "@/types/room";

const ROOM_STATUS_ORDER: RoomStatus[] = ["occupied", "available", "maintenance", "inactive"];

export function DashboardPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { rooms } = useRooms();
  const { tenants } = useTenants();
  const { records } = useBillingRecords();

  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const available = rooms.filter((r) => r.status === "available").length;
  const activeTenants = tenants.filter((tenant) => tenant.status === "active").length;
  const estimatedIncome = rooms.filter((r) => r.status === "occupied").reduce((sum, r) => sum + r.monthlyRent, 0);
  const outstandingInvoices = records.filter((r) => {
    const status = resolveBillingStatus(r);
    return status === "issued" || status === "overdue";
  }).length;

  const summaryCards = [
    { label: t("dashboard.totalRooms"), value: rooms.length, icon: Building2 },
    { label: t("dashboard.occupied"), value: occupied, icon: DoorOpen },
    { label: t("dashboard.available"), value: available, icon: CheckCircle2 },
    { label: t("dashboard.totalTenants"), value: activeTenants, icon: Users },
    { label: t("dashboard.estMonthlyIncome"), value: formatCurrency(estimatedIncome, language), icon: Wallet },
    { label: t("dashboard.outstandingInvoices"), value: outstandingInvoices, icon: AlertCircle },
  ];

  const recentRecords = [...records]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const roomsByStatus = ROOM_STATUS_ORDER.map((status) => ({
    status,
    count: rooms.filter((r) => r.status === status).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <card.icon className="h-8 w-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{card.label}</p>
                <p className="truncate text-lg font-semibold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.roomStatusOverview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {roomsByStatus.map(({ status, count }) => {
              const pct = rooms.length > 0 ? Math.round((count / rooms.length) * 100) : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <StatusBadge status={status} />
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentBilling")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentRecords.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={t("dashboard.noBillingTitle")}
                description={t("dashboard.noBillingDescription")}
                actionLabel={t("dashboard.createBilling")}
                onAction={() => navigate("/billing")}
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
                    const tenant = tenants.find((tenantItem) => tenantItem.id === record.tenantId);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>{room?.roomNumber ?? "—"}</TableCell>
                        <TableCell>{tenant ? `${tenant.firstName} ${tenant.lastName}` : "—"}</TableCell>
                        <TableCell>{formatBillingMonth(record.billingMonth, language)}</TableCell>
                        <TableCell>{formatCurrency(record.total, language)}</TableCell>
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
          <CardTitle className="text-base">{t("dashboard.quickActions")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/rooms")}>
            <Plus /> {t("dashboard.addRoom")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/tenants")}>
            <UserPlus /> {t("dashboard.addTenant")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/billing")}>
            <Receipt /> {t("dashboard.createBilling")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/invoices")}>
            <FileText /> {t("dashboard.viewInvoices")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
