import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { CheckCircle2, Download, Eye, FileText, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSpinner } from "@/components/common/PageSpinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SearchInput } from "@/components/common/SearchInput";
import { Pagination } from "@/components/common/Pagination";
import { FilterButton } from "@/components/common/FilterButton";
import { SortButton } from "@/components/common/SortButton";
import { SortableTableHead } from "@/components/common/SortableTableHead";
import { InvoicePreviewDialog } from "@/features/invoices/InvoicePreviewDialog";
import { useAuth } from "@/auth";
import { usePagination } from "@/hooks/usePagination";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/i18n";
import { formatAmount, formatCurrency } from "@/lib/currency";
import { formatBillingMonth, formatDate, monthName, yearLabel } from "@/lib/date";
import { resolveInvoiceStatus } from "@/lib/invoice";
import { matchesSearch } from "@/lib/search";
import { compareSortValues, type SortDirection } from "@/lib/sort";
import { invoiceRecordsFromBilling, type InvoiceRecord } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

type InvoiceStatusTab = "all" | "issued" | "overdue" | "superseded" | "paid";
type InvoiceSortKey = "invoiceNumber" | "room" | "tenant" | "billingMonth" | "issuedAt" | "dueDate" | "total" | "status";

export function InvoicesPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { records, isLoading, markInvoicePaid, deleteInvoice } = useBillingRecords();
  const { rooms } = useRooms();
  const { tenants } = useTenants();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [previewRecord, setPreviewRecord] = useState<InvoiceRecord | undefined>(undefined);
  const [deletingInvoices, setDeletingInvoices] = useState<InvoiceRecord[] | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [statusTab, setStatusTab] = useState<InvoiceStatusTab>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: InvoiceSortKey; direction: SortDirection }>({ key: "issuedAt", direction: "desc" });

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
        .flatMap(invoiceRecordsFromBilling)
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    [records]
  );

  const selectedDeletableInvoices = useMemo(
    () => invoices.filter((record) => selectedIds.has(record.id) && record.status === "superseded"),
    [invoices, selectedIds],
  );

  const availableYears = useMemo(
    () => Array.from(new Set(invoices.map((r) => r.billingMonth.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [invoices]
  );

  const filteredInvoices = useMemo(
    () =>
      invoices
        .filter((record) => statusTab === "all" || resolveInvoiceStatus(record) === statusTab)
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
    [invoices, searchQuery, monthFilter, yearFilter, statusTab, roomById, tenantById, language]
  );

  const sortedFilteredInvoices = useMemo(
    () =>
      [...filteredInvoices].sort((left, right) => {
        const value = (record: InvoiceRecord) => {
          const room = roomById[record.roomId];
          const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
          switch (sort.key) {
            case "room": return room?.roomNumber;
            case "tenant": return tenant?.name;
            case "billingMonth": return record.billingMonth;
            case "issuedAt": return record.issuedAt;
            case "dueDate": return record.dueDate;
            case "total": return record.total;
            case "status": return t(`status.${resolveInvoiceStatus(record)}`);
            default: return record.invoiceNumber;
          }
        };
        return compareSortValues(value(left), value(right), sort.direction, language);
      }),
    [filteredInvoices, sort, roomById, tenantById, language, t]
  );

  const { page, setPage, pageSize, setPageSize, totalPages, totalItems, pageItems } = usePagination(sortedFilteredInvoices);

  function handleSort(key: InvoiceSortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
    setPage(1);
  }

  const pageIds = pageItems.map((record) => record.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && pageIds.some((id) => selectedIds.has(id));

  function toggleRecord(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: string[]) {
    setSelectedIds((prev) => {
      const shouldSelectAll = !(ids.length > 0 && ids.every((id) => prev.has(id)));
      const next = new Set(prev);
      for (const id of ids) {
        if (shouldSelectAll) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function printSelected() {
    const params = new URLSearchParams({ ids: Array.from(selectedIds).join(",") });
    navigate(`/invoices/print?${params.toString()}`);
  }

  async function exportSelected() {
    const { downloadInvoiceExcelExport } = await import("@/lib/excel");
    const selected = invoices.filter((record) => selectedIds.has(record.id));
    const rows = selected.map((record) => {
      const room = roomById[record.roomId];
      return {
        billingMonth: formatBillingMonth(record.billingMonth, language),
        roomLabel: `${t("invoice.room")} ${room?.roomNumber ?? "—"}`,
        rent: record.rentAmount,
        water: record.water.amount,
        electricity: record.electricity.amount,
        otherCharges: record.otherCharges.reduce((sum, charge) => sum + charge.amount, 0),
        total: record.total,
      };
    });
    const now = new Date();
    const exportedAt = `${formatDate(now.toISOString(), language)} ${now.toLocaleTimeString(language === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" })}`;
    await downloadInvoiceExcelExport(
      rows,
      { exportedAt, exportedBy: user?.name ?? user?.email ?? "-" },
      {
        exportDateLabel: t("invoice.exportDateLabel"),
        exportByLabel: t("invoice.exportByLabel"),
        billingMonth: t("invoice.billingMonth"),
        item: t("invoice.itemColumn"),
        rent: t("invoice.rentItem"),
        water: t("invoice.waterItem"),
        electricity: t("invoice.electricityItem"),
        other: t("invoice.otherChargesColumn"),
        total: t("invoice.totalLabel"),
      }
    );
  }

  async function markPaid(record: InvoiceRecord) {
    try {
      await markInvoicePaid(record.billingId, record.id);
      toast.success(t("invoice.paidToast"));
      setPreviewRecord(undefined);
    } catch {
      toast.error(t("common.actionFailed"));
    }
  }

  async function handleDeleteInvoices() {
    if (!deletingInvoices?.length) return;
    try {
      for (const invoice of deletingInvoices) {
        await deleteInvoice(invoice.billingId, invoice.id);
      }
      toast.success(t("invoice.deletedToast"));
      setSelectedIds((previous) => {
        const next = new Set(previous);
        deletingInvoices.forEach((invoice) => next.delete(invoice.id));
        return next;
      });
      setDeletingInvoices(undefined);
    } catch {
      toast.error(t("common.actionFailed"));
    }
  }

  if (isLoading || !settings) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("invoice.title")}
        description={t("invoice.description")}
        actions={
          selectedIds.size > 0 ? (
            <>
              <Button variant="outline" onClick={exportSelected}>
                <Download className="h-4 w-4" /> {t("invoice.bulkExportSelected", { count: selectedIds.size })}
              </Button>
              <Button onClick={printSelected}>
                <Printer className="h-4 w-4" /> {t("invoice.bulkPrintSelected", { count: selectedIds.size })}
              </Button>
              {isAdmin && selectedDeletableInvoices.length > 0 && (
                <Button variant="destructive" onClick={() => setDeletingInvoices(selectedDeletableInvoices)}>
                  <Trash2 className="h-4 w-4" /> {t("invoice.deleteSelected", { count: selectedDeletableInvoices.length })}
                </Button>
              )}
            </>
          ) : undefined
        }
      />

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
          <Tabs
            value={statusTab}
            onValueChange={(value) => {
              setStatusTab(value as InvoiceStatusTab);
              setPage(1);
            }}
          >
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="all">{t("common.allStatuses")}</TabsTrigger>
              <TabsTrigger value="issued">{t("status.issued")}</TabsTrigger>
              <TabsTrigger value="overdue">{t("status.overdue")}</TabsTrigger>
              <TabsTrigger value="superseded">{t("status.superseded")}</TabsTrigger>
              <TabsTrigger value="paid">{t("status.paid")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setPage(1);
              }}
              placeholder={t("common.search")}
              className="w-full sm:max-w-sm"
            />
            <div className="grid grid-cols-2 gap-3 md:block">
              <FilterButton
                className="sm:w-full md:w-auto"
                fields={[
                {
                  key: "month",
                  label: t("common.month"),
                  options: [
                    { value: "all", label: t("common.allMonths") },
                    ...MONTHS.map((month) => ({ value: month, label: monthName(Number(month), language) })),
                  ],
                },
                {
                  key: "year",
                  label: t("common.year"),
                  options: [
                    { value: "all", label: t("common.allYears") },
                    ...availableYears.map((year) => ({ value: year, label: yearLabel(Number(year), language) })),
                  ],
                },
              ]}
                values={{ month: monthFilter, year: yearFilter }}
                onApply={(values) => {
                  setMonthFilter(values.month ?? "all");
                  setYearFilter(values.year ?? "all");
                  setPage(1);
                }}
              />
              <SortButton
                className="md:hidden"
                fields={[
                  { key: "invoiceNumber", label: t("invoice.invoiceNumber") },
                  { key: "room", label: t("common.room") },
                  { key: "tenant", label: t("common.tenant") },
                  { key: "billingMonth", label: t("invoice.billingMonth") },
                  { key: "issuedAt", label: t("invoice.issueDate") },
                  { key: "dueDate", label: t("common.dueDate") },
                  { key: "total", label: t("invoice.amountColumn") },
                  { key: "status", label: t("common.status") },
                ]}
                value={sort}
                onApply={(value) => {
                  setSort({ key: value.key as InvoiceSortKey, direction: value.direction });
                  setPage(1);
                }}
              />
            </div>
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
                setStatusTab("all");
                setPage(1);
              }}
            />
          ) : (
            <>
          <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={someSelected ? "indeterminate" : allSelected}
                      onCheckedChange={() => toggleAll(pageIds)}
                      disabled={pageIds.length === 0}
                      aria-label={t("common.selectAll")}
                    />
                  </TableHead>
                  <SortableTableHead label={t("invoice.invoiceNumber")} active={sort.key === "invoiceNumber"} direction={sort.direction} onSort={() => handleSort("invoiceNumber")} />
                  <SortableTableHead label={t("common.room")} active={sort.key === "room"} direction={sort.direction} onSort={() => handleSort("room")} />
                  <SortableTableHead label={t("common.tenant")} active={sort.key === "tenant"} direction={sort.direction} onSort={() => handleSort("tenant")} />
                  <SortableTableHead label={t("invoice.billingMonth")} active={sort.key === "billingMonth"} direction={sort.direction} onSort={() => handleSort("billingMonth")} />
                  <SortableTableHead label={t("invoice.issueDate")} active={sort.key === "issuedAt"} direction={sort.direction} onSort={() => handleSort("issuedAt")} />
                  <SortableTableHead label={t("common.dueDate")} active={sort.key === "dueDate"} direction={sort.direction} onSort={() => handleSort("dueDate")} />
                  <SortableTableHead label={t("invoice.amountColumn")} active={sort.key === "total"} direction={sort.direction} onSort={() => handleSort("total")} />
                  <SortableTableHead label={t("common.status")} active={sort.key === "status"} direction={sort.direction} onSort={() => handleSort("status")} />
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((record) => {
                  const room = roomById[record.roomId];
                  const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
                  return (
                    <TableRow key={record.id} data-state={selectedIds.has(record.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(record.id)}
                          onCheckedChange={() => toggleRecord(record.id)}
                          aria-label={t("common.selectRow")}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{record.invoiceNumber}</TableCell>
                      <TableCell>{room?.roomNumber ?? "—"}</TableCell>
                      <TableCell>{tenant ? tenant.name : "—"}</TableCell>
                      <TableCell>{formatBillingMonth(record.billingMonth, language)}</TableCell>
                      <TableCell>{record.issuedAt ? formatDate(record.issuedAt, language) : "—"}</TableCell>
                      <TableCell>{record.dueDate ? formatDate(record.dueDate, language) : "—"}</TableCell>
                      <TableCell>{formatAmount(record.total, language)}</TableCell>
                      <TableCell>
                        <StatusBadge status={resolveInvoiceStatus(record)} />
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
                                onClick={() => navigate(`/invoices/${record.billingId}?invoice=${record.id}`)}
                              >
                                <Printer className="h-4 w-4" />
                                <span className="sr-only">{t("invoice.printExport")}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("invoice.printExport")}</TooltipContent>
                          </Tooltip>
                          {isAdmin && (resolveInvoiceStatus(record) === "issued" || resolveInvoiceStatus(record) === "overdue") && (
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
                          {isAdmin && record.status === "superseded" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeletingInvoices([record])}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">{t("invoice.deleteInvoice")}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("invoice.deleteInvoice")}</TooltipContent>
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
            {pageItems.map((record) => {
              const room = roomById[record.roomId];
              const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
              return (
                <Card key={record.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          className="mt-1"
                          checked={selectedIds.has(record.id)}
                          onCheckedChange={() => toggleRecord(record.id)}
                          aria-label={t("common.selectRow")}
                        />
                        <div>
                          <p className="font-medium">{record.invoiceNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("invoice.mobileCardSubtitle", {
                              roomNumber: room?.roomNumber ?? "—",
                              tenant: tenant ? tenant.name : t("common.noTenant"),
                            })}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={resolveInvoiceStatus(record)} />
                    </div>
                    <p className="text-sm text-muted-foreground">{formatBillingMonth(record.billingMonth, language)}</p>
                    <p className="text-lg font-semibold">{formatCurrency(record.total, language)}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => setPreviewRecord(record)}>
                        {t("invoice.preview")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/invoices/${record.billingId}?invoice=${record.id}`)}>
                        <Printer className="h-4 w-4" /> {t("invoice.print")}
                      </Button>
                      {isAdmin && (resolveInvoiceStatus(record) === "issued" || resolveInvoiceStatus(record) === "overdue") && (
                        <Button size="sm" onClick={() => markPaid(record)}>
                          {t("invoice.markAsPaid")}
                        </Button>
                      )}
                      {isAdmin && record.status === "superseded" && (
                        <Button size="sm" variant="destructive" onClick={() => setDeletingInvoices([record])}>
                          <Trash2 className="h-4 w-4" /> {t("invoice.deleteInvoice")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
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

      <ConfirmDialog
        open={deletingInvoices !== undefined}
        onOpenChange={(open) => !open && setDeletingInvoices(undefined)}
        title={t("invoice.deleteConfirmTitle")}
        description={t("invoice.deleteConfirmDescription", { count: deletingInvoices?.length ?? 0 })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={handleDeleteInvoices}
      />
    </div>
  );
}
