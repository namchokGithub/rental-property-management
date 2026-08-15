import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { PageSpinner } from "@/components/common/PageSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SearchInput } from "@/components/common/SearchInput";
import { Pagination } from "@/components/common/Pagination";
import { FilterButton } from "@/components/common/FilterButton";
import { SortButton } from "@/components/common/SortButton";
import { BillingTable } from "@/features/billing/BillingTable";
import { BillingFormDialog } from "@/features/billing/BillingFormDialog";
import { useAuth } from "@/auth";
import { usePagination } from "@/hooks/usePagination";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useAssignments } from "@/hooks/useAssignments";
import { useSettings } from "@/hooks/useSettings";
import { useOtherCharges } from "@/hooks/useOtherCharges";
import { useLanguage } from "@/i18n";
import { matchesSearch } from "@/lib/search";
import { compareSortValues, type SortDirection } from "@/lib/sort";
import { formatBillingMonth, monthName, yearLabel } from "@/lib/date";
import { latestInvoiceFromBilling, resolveBillingStatus } from "@/lib/invoice";
import { type BillingRecord, type BillingStatus } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";
import type { BillingSortKey } from "@/features/billing/BillingTable";

const BILLING_STATUSES: BillingStatus[] = ["draft", "issued", "paid", "overdue"];
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

export function BillingPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { records, isLoading, createBilling, updateBilling, reissueBilling, markInvoicePaid, deleteBilling } = useBillingRecords();
  const { rooms } = useRooms();
  const { tenants } = useTenants();
  const { assignments } = useAssignments();
  const { settings } = useSettings();
  const { otherCharges } = useOtherCharges();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingRecord | undefined>(undefined);
  const [deletingRecord, setDeletingRecord] = useState<BillingRecord | undefined>(undefined);
  const [issuingRecord, setIssuingRecord] = useState<BillingRecord | undefined>(undefined);
  const [confirmingBulkIssue, setConfirmingBulkIssue] = useState(false);
  const [markingPaidRecord, setMarkingPaidRecord] = useState<BillingRecord | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillingStatus | "all">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isIssuing, setIsIssuing] = useState(false);
  const [sort, setSort] = useState<{ key: BillingSortKey; direction: SortDirection }>({ key: "billingMonth", direction: "desc" });

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

  const activeAssignments = assignments.filter((a) => a.status === "active");

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.billingMonth.localeCompare(a.billingMonth) || b.createdAt.localeCompare(a.createdAt)),
    [records]
  );

  const availableYears = useMemo(
    () => Array.from(new Set(records.map((r) => r.billingMonth.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [records]
  );

  const filteredRecords = useMemo(
    () =>
      sortedRecords
        .filter((record) => statusFilter === "all" || resolveBillingStatus(record) === statusFilter)
        .filter((record) => {
          const [year, month] = record.billingMonth.split("-");
          return (yearFilter === "all" || year === yearFilter) && (monthFilter === "all" || month === monthFilter);
        })
        .filter((record) => {
          const room = roomById[record.roomId];
          const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
          return matchesSearch(
            searchQuery,
            room?.roomNumber,
            tenant ? tenant.name : undefined,
            latestInvoiceFromBilling(record)?.invoiceNumber ?? record.invoiceNumber,
            record.billingMonth,
            formatBillingMonth(record.billingMonth, language)
          );
        }),
    [sortedRecords, searchQuery, statusFilter, monthFilter, yearFilter, roomById, tenantById, language]
  );

  const sortedFilteredRecords = useMemo(
    () =>
      [...filteredRecords].sort((left, right) => {
        const value = (record: BillingRecord) => {
          const room = roomById[record.roomId];
          const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
          switch (sort.key) {
            case "room": return room?.roomNumber;
            case "tenant": return tenant?.name;
            case "invoiceNumber": return latestInvoiceFromBilling(record)?.invoiceNumber ?? record.invoiceNumber;
            case "total": return record.total;
            case "status": return t(`status.${resolveBillingStatus(record)}`);
            default: return record.billingMonth;
          }
        };
        return compareSortValues(value(left), value(right), sort.direction, language);
      }),
    [filteredRecords, sort, roomById, tenantById, language, t]
  );

  const { page, setPage, pageSize, setPageSize, totalPages, totalItems, pageItems } = usePagination(sortedFilteredRecords);

  function handleSort(key: BillingSortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
    setPage(1);
  }

  function getLatestByRoomId(roomId: string): BillingRecord | undefined {
    return records
      .filter((r) => r.roomId === roomId)
      .sort((a, b) => b.billingMonth.localeCompare(a.billingMonth))[0];
  }

  const draftIds = useMemo(
    () => new Set(records.filter((record) => resolveBillingStatus(record) === "draft").map((record) => record.id)),
    [records],
  );
  const effectiveSelectedIds = useMemo(
    () => new Set([...selectedIds].filter((id) => draftIds.has(id))),
    [selectedIds, draftIds]
  );

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
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleBulkIssue() {
    if (isIssuing) return;
    const ids = [...effectiveSelectedIds];
    if (ids.length === 0) return;
    setIsIssuing(true);
    // MUST stay sequential (for...of + await, not Promise.all): each
    // transactional issuance reads the freshest "existing records for this
    // month" state, so one issuance's write must commit before the next one
    // reads — firing them concurrently would defeat that guarantee. Stops at
    // the first failure rather than continuing past it, and only clears the
    // ids that actually succeeded so a partial batch isn't misreported as
    // fully issued.
    const issuedIds: string[] = [];
    try {
      for (const id of ids) {
        await updateBilling(id, { status: "issued" });
        issuedIds.push(id);
      }
      toast.success(t("billing.bulkIssuedToast", { count: issuedIds.length }));
      setConfirmingBulkIssue(false);
    } catch {
      toast.error(t("common.actionFailed"));
    } finally {
      setIsIssuing(false);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        issuedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  if (isLoading || !settings) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("billing.title")}
        description={t("billing.description")}
        actions={
          isAdmin && (
            <div className="flex items-center gap-2">
              {effectiveSelectedIds.size > 0 && (
                <Button variant="secondary" onClick={() => setConfirmingBulkIssue(true)} disabled={isIssuing}>
                  <Send /> {t("billing.bulkIssueSelected", { count: effectiveSelectedIds.size })}
                </Button>
              )}
              <Button
                onClick={() => {
                  setEditingRecord(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus /> {t("billing.createBilling")}
              </Button>
            </div>
          )
        }
      />

      {records.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("billing.noBillingTitle")}
          description={t("billing.noBillingDescription")}
          actionLabel={isAdmin ? t("billing.createBilling") : undefined}
          onAction={
            isAdmin
              ? () => {
                  setEditingRecord(undefined);
                  setFormOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <>
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
                  key: "status",
                  label: t("common.status"),
                  options: [
                    { value: "all", label: t("common.allStatuses") },
                    ...BILLING_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
                  ],
                },
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
                values={{ status: statusFilter, month: monthFilter, year: yearFilter }}
                onApply={(values) => {
                  setStatusFilter((values.status as BillingStatus | "all") ?? "all");
                  setMonthFilter(values.month ?? "all");
                  setYearFilter(values.year ?? "all");
                  setPage(1);
                }}
              />
              <SortButton
                className="md:hidden"
                fields={[
                  { key: "room", label: t("common.room") },
                  { key: "tenant", label: t("common.tenant") },
                  { key: "invoiceNumber", label: t("billing.invoiceNumber") },
                  { key: "billingMonth", label: t("common.month") },
                  { key: "total", label: t("common.total") },
                  { key: "status", label: t("common.status") },
                ]}
                value={sort}
                onApply={(value) => {
                  setSort({ key: value.key as BillingSortKey, direction: value.direction });
                  setPage(1);
                }}
              />
            </div>
          </div>
          {filteredRecords.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t("common.noResultsTitle")}
              description={t("common.noResultsDescription", { query: searchQuery })}
              actionLabel={t("common.clearSearch")}
              onAction={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setMonthFilter("all");
                setYearFilter("all");
                setPage(1);
              }}
            />
          ) : (
            <>
              <BillingTable
                records={pageItems}
                roomById={roomById}
                tenantById={tenantById}
                onEdit={(record) => {
                  setEditingRecord(record);
                  setFormOpen(true);
                }}
                onDelete={setDeletingRecord}
                onIssue={setIssuingRecord}
                onReissue={async (record) => {
                  try {
                    const invoiceNumber = await reissueBilling(record.id);
                    toast.success(t("billing.reissuedToast", { invoiceNumber }));
                  } catch {
                    toast.error(t("common.actionFailed"));
                  }
                }}
                onMarkPaid={setMarkingPaidRecord}
                selectedIds={effectiveSelectedIds}
                onToggleRecord={toggleRecord}
                onToggleAll={toggleAll}
                sort={sort}
                onSort={handleSort}
              />
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

      <BillingFormDialog
        key={editingRecord?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        rooms={rooms}
        tenants={tenants}
        activeAssignments={activeAssignments}
        settings={settings}
        otherCharges={otherCharges}
        record={editingRecord}
        getLatestByRoomId={getLatestByRoomId}
        onSubmit={async (input) => {
          if (editingRecord) {
            return updateBilling(editingRecord.id, input);
          }
          // `create()` always persists as a draft regardless of
          // `input.status` (see billingRepository.ts) — a create+issue
          // submission must go through a *second*, separately-awaited
          // `update()` call against the now-existing draft, since that's the
          // only path where the transactional sibling-pinning that prevents
          // duplicate invoice numbers actually applies. Both calls share this
          // same try/catch (via BillingFormDialog's handleSubmit, which wraps
          // onSubmit): if create succeeds but this follow-up issue fails, the
          // record is left as a committed draft — a safe, recoverable state,
          // since the user can just click "Issue" again from the table — and
          // the thrown error surfaces the existing generic failure toast
          // rather than a silent partial success.
          const newId = await createBilling(input);
          if (input.status === "issued") {
            await updateBilling(newId, { status: "issued" });
          }
        }}
      />

      <ConfirmDialog
        open={deletingRecord !== undefined}
        onOpenChange={(open) => !open && setDeletingRecord(undefined)}
        title={t("billing.deleteConfirmTitle")}
        description={t("billing.deleteConfirmDescription", {
          roomNumber: deletingRecord ? roomById[deletingRecord.roomId]?.roomNumber ?? "" : "",
        })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          if (!deletingRecord) return;
          try {
            await deleteBilling(deletingRecord.id);
            toast.success(t("billing.deletedToast"));
            setDeletingRecord(undefined);
          } catch {
            toast.error(t("common.actionFailed"));
          }
        }}
      />

      <ConfirmDialog
        open={issuingRecord !== undefined}
        onOpenChange={(open) => !open && setIssuingRecord(undefined)}
        title={t("billing.issueConfirmTitle")}
        description={t("billing.issueConfirmDescription", {
          roomNumber: issuingRecord ? roomById[issuingRecord.roomId]?.roomNumber ?? "" : "",
        })}
        confirmLabel={t("common.issue")}
        onConfirm={async () => {
          if (!issuingRecord) return;
          try {
            const { invoiceNumber } = await updateBilling(issuingRecord.id, { status: "issued" });
            toast.success(t("billing.issuedToast", { invoiceNumber: invoiceNumber ?? "" }));
            setIssuingRecord(undefined);
          } catch {
            toast.error(t("common.actionFailed"));
          }
        }}
      />

      <ConfirmDialog
        open={confirmingBulkIssue}
        onOpenChange={(open) => !open && setConfirmingBulkIssue(false)}
        title={t("billing.bulkIssueConfirmTitle")}
        description={t("billing.bulkIssueConfirmDescription", { count: effectiveSelectedIds.size })}
        confirmLabel={t("common.issue")}
        onConfirm={handleBulkIssue}
      />

      <ConfirmDialog
        open={markingPaidRecord !== undefined}
        onOpenChange={(open) => !open && setMarkingPaidRecord(undefined)}
        title={t("billing.markPaidConfirmTitle")}
        description={t("billing.markPaidConfirmDescription", {
          invoiceNumber: markingPaidRecord ? latestInvoiceFromBilling(markingPaidRecord)?.invoiceNumber ?? "" : "",
        })}
        confirmLabel={t("common.markAsPaid")}
        onConfirm={async () => {
          if (!markingPaidRecord) return;
          try {
            const invoice = latestInvoiceFromBilling(markingPaidRecord);
            if (invoice?.status !== "issued") return;
            await markInvoicePaid(markingPaidRecord.id, invoice.id);
            toast.success(t("billing.paidToast"));
            setMarkingPaidRecord(undefined);
          } catch {
            toast.error(t("common.actionFailed"));
          }
        }}
      />
    </div>
  );
}
