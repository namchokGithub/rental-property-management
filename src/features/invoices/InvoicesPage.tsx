import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { CheckCircle2, Eye, FileText, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSpinner } from "@/components/common/PageSpinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SearchInput } from "@/components/common/SearchInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvoicePreviewDialog } from "@/features/invoices/InvoicePreviewDialog";
import { useAuth } from "@/auth";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import { formatBillingMonth, formatDate, monthName, yearLabel } from "@/lib/date";
import { resolveBillingStatus } from "@/lib/invoice";
import { matchesSearch } from "@/lib/search";
import type { BillingRecord } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

export function InvoicesPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { records, isLoading, updateBilling } = useBillingRecords();
  const { rooms } = useRooms();
  const { tenants } = useTenants();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [previewRecord, setPreviewRecord] = useState<BillingRecord | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");

  const roomById = useMemo(() => {
    const map: Record<string, Room> = {};
    for (const room of rooms) map[room.id] = room;
    return map;
  }, [rooms]);

  const tenantById = useMemo(() => {
    const map: Record<string, Tenant> = {};
    for (const tenant of tenants) map[tenant.id] = tenant;
    return map;
  }, [tenants]);

  const invoices = useMemo(
    () =>
      records
        .filter((r) => r.invoiceNumber)
        .sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? "")),
    [records]
  );

  const availableYears = useMemo(
    () => Array.from(new Set(invoices.map((r) => r.billingMonth.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [invoices]
  );

  const filteredInvoices = useMemo(
    () =>
      invoices
        .filter((record) => {
          const [year, month] = record.billingMonth.split("-");
          return (yearFilter === "all" || year === yearFilter) && (monthFilter === "all" || month === monthFilter);
        })
        .filter((record) => {
          const room = roomById[record.roomId];
          const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
          return matchesSearch(
            searchQuery,
            record.invoiceNumber,
            room?.roomNumber,
            tenant ? tenant.name : undefined,
            formatBillingMonth(record.billingMonth, language)
          );
        }),
    [invoices, searchQuery, monthFilter, yearFilter, roomById, tenantById, language]
  );

  async function markPaid(record: BillingRecord) {
    try {
      await updateBilling(record.id, { status: "paid" });
      toast.success(t("invoice.paidToast"));
      setPreviewRecord(undefined);
    } catch {
      toast.error(t("common.actionFailed"));
    }
  }

  if (isLoading || !settings) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("invoice.title")} description={t("invoice.description")} />

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("invoice.noInvoicesTitle")}
          description={t("invoice.noInvoicesDescription")}
          actionLabel={t("invoice.goToBilling")}
          onAction={() => navigate("/billing")}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t("common.search")}
              className="w-full sm:max-w-sm"
            />
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allMonths")}</SelectItem>
                {MONTHS.map((month) => (
                  <SelectItem key={month} value={month}>
                    {monthName(Number(month), language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allYears")}</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {yearLabel(Number(year), language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredInvoices.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t("common.noResultsTitle")}
              description={t("common.noResultsDescription", { query: searchQuery })}
              actionLabel={t("common.clearSearch")}
              onAction={() => {
                setSearchQuery("");
                setMonthFilter("all");
                setYearFilter("all");
              }}
            />
          ) : (
            <>
          <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoice.invoiceNumber")}</TableHead>
                  <TableHead>{t("common.room")}</TableHead>
                  <TableHead>{t("common.tenant")}</TableHead>
                  <TableHead>{t("invoice.billingMonth")}</TableHead>
                  <TableHead>{t("invoice.issueDate")}</TableHead>
                  <TableHead>{t("common.dueDate")}</TableHead>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((record) => {
                  const room = roomById[record.roomId];
                  const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
                  const status = resolveBillingStatus(record);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.invoiceNumber}</TableCell>
                      <TableCell>{room?.roomNumber ?? "—"}</TableCell>
                      <TableCell>{tenant ? tenant.name : "—"}</TableCell>
                      <TableCell>{formatBillingMonth(record.billingMonth, language)}</TableCell>
                      <TableCell>{record.issuedAt ? formatDate(record.issuedAt, language) : "—"}</TableCell>
                      <TableCell>{record.dueDate ? formatDate(record.dueDate, language) : "—"}</TableCell>
                      <TableCell>{formatCurrency(record.total, language)}</TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewRecord(record)}>
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">{t("invoice.preview")}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("invoice.preview")}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/invoices/${record.id}`)}
                              >
                                <Printer className="h-4 w-4" />
                                <span className="sr-only">{t("invoice.printExport")}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("invoice.printExport")}</TooltipContent>
                          </Tooltip>
                          {isAdmin && (status === "issued" || status === "overdue") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markPaid(record)}>
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="sr-only">{t("invoice.markAsPaid")}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("invoice.markAsPaid")}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredInvoices.map((record) => {
              const room = roomById[record.roomId];
              const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
              const status = resolveBillingStatus(record);
              return (
                <Card key={record.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{record.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("invoice.mobileCardSubtitle", {
                            roomNumber: room?.roomNumber ?? "—",
                            tenant: tenant ? tenant.name : t("common.noTenant"),
                          })}
                        </p>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{formatBillingMonth(record.billingMonth, language)}</p>
                    <p className="text-lg font-semibold">{formatCurrency(record.total, language)}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => setPreviewRecord(record)}>
                        {t("invoice.preview")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/invoices/${record.id}`)}>
                        <Printer className="h-4 w-4" /> {t("invoice.print")}
                      </Button>
                      {isAdmin && (status === "issued" || status === "overdue") && (
                        <Button size="sm" onClick={() => markPaid(record)}>
                          {t("invoice.markAsPaid")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
            </>
          )}
        </>
      )}

      <InvoicePreviewDialog
        open={previewRecord !== undefined}
        onOpenChange={(open) => !open && setPreviewRecord(undefined)}
        record={previewRecord}
        room={previewRecord ? roomById[previewRecord.roomId] : undefined}
        tenant={previewRecord?.tenantId ? tenantById[previewRecord.tenantId] : undefined}
        settings={settings}
        onMarkPaid={markPaid}
      />
    </div>
  );
}
