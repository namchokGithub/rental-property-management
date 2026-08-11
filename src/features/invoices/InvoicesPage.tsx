import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { CheckCircle2, Eye, FileText, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SearchInput } from "@/components/common/SearchInput";
import { InvoicePreviewDialog } from "@/features/invoices/InvoicePreviewDialog";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import { formatBillingMonth, formatDate } from "@/lib/date";
import { resolveBillingStatus } from "@/lib/invoice";
import { matchesSearch } from "@/lib/search";
import type { BillingRecord } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";

export function InvoicesPage() {
  const { t, language } = useLanguage();
  const { records, updateBilling } = useBillingRecords();
  const { rooms } = useRooms();
  const { tenants } = useTenants();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [previewRecord, setPreviewRecord] = useState<BillingRecord | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((record) => {
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
    [invoices, searchQuery, roomById, tenantById, language]
  );

  function markPaid(record: BillingRecord) {
    updateBilling(record.id, { status: "paid" });
    toast.success(t("invoice.paidToast"));
    setPreviewRecord(undefined);
  }

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
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("common.search")}
            className="w-full sm:max-w-sm"
          />
          {filteredInvoices.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t("common.noResultsTitle")}
              description={t("common.noResultsDescription", { query: searchQuery })}
              actionLabel={t("common.clearSearch")}
              onAction={() => setSearchQuery("")}
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
                          {(status === "issued" || status === "overdue") && (
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
                      {(status === "issued" || status === "overdue") && (
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
