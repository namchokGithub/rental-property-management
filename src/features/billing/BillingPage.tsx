import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { PageSpinner } from "@/components/common/PageSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SearchInput } from "@/components/common/SearchInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BillingTable } from "@/features/billing/BillingTable";
import { BillingFormDialog } from "@/features/billing/BillingFormDialog";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useAssignments } from "@/hooks/useAssignments";
import { useSettings } from "@/hooks/useSettings";
import { useOtherCharges } from "@/hooks/useOtherCharges";
import { useLanguage } from "@/i18n";
import { matchesSearch } from "@/lib/search";
import { formatBillingMonth, monthName, yearLabel } from "@/lib/date";
import { resolveBillingStatus } from "@/lib/invoice";
import type { BillingRecord, BillingStatus } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";

const BILLING_STATUSES: BillingStatus[] = ["draft", "issued", "paid", "overdue"];
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

export function BillingPage() {
  const { t, language } = useLanguage();
  const { records, createBilling, updateBilling, deleteBilling } = useBillingRecords();
  const { rooms } = useRooms();
  const { tenants } = useTenants();
  const { assignments } = useAssignments();
  const { settings } = useSettings();
  const { otherCharges } = useOtherCharges();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingRecord | undefined>(undefined);
  const [deletingRecord, setDeletingRecord] = useState<BillingRecord | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillingStatus | "all">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
            record.invoiceNumber,
            record.billingMonth,
            formatBillingMonth(record.billingMonth, language)
          );
        }),
    [sortedRecords, searchQuery, statusFilter, monthFilter, yearFilter, roomById, tenantById, language]
  );

  function getLatestByRoomId(roomId: string): BillingRecord | undefined {
    return records
      .filter((r) => r.roomId === roomId)
      .sort((a, b) => b.billingMonth.localeCompare(a.billingMonth))[0];
  }

  const draftIds = useMemo(() => new Set(records.filter((r) => r.status === "draft").map((r) => r.id)), [records]);
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

  function handleBulkIssue() {
    const ids = [...effectiveSelectedIds];
    if (ids.length === 0) return;
    for (const id of ids) {
      updateBilling(id, { status: "issued" });
    }
    toast.success(t("billing.bulkIssuedToast", { count: ids.length }));
    setSelectedIds(new Set());
  }

  if (!settings) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("billing.title")}
        description={t("billing.description")}
        actions={
          <div className="flex items-center gap-2">
            {effectiveSelectedIds.size > 0 && (
              <Button variant="secondary" onClick={handleBulkIssue}>
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
        }
      />

      {records.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("billing.noBillingTitle")}
          description={t("billing.noBillingDescription")}
          actionLabel={t("billing.createBilling")}
          onAction={() => {
            setEditingRecord(undefined);
            setFormOpen(true);
          }}
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
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BillingStatus | "all")}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
                {BILLING_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              }}
            />
          ) : (
            <BillingTable
              records={filteredRecords}
              roomById={roomById}
              tenantById={tenantById}
              onEdit={(record) => {
                setEditingRecord(record);
                setFormOpen(true);
              }}
              onDelete={setDeletingRecord}
              onIssue={(record) => {
                const updated = updateBilling(record.id, { status: "issued" });
                toast.success(t("billing.issuedToast", { invoiceNumber: updated.invoiceNumber ?? "" }));
              }}
              onMarkPaid={(record) => {
                updateBilling(record.id, { status: "paid" });
                toast.success(t("billing.paidToast"));
              }}
              selectedIds={effectiveSelectedIds}
              onToggleRecord={toggleRecord}
              onToggleAll={toggleAll}
            />
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
        onSubmit={(input) => {
          if (editingRecord) {
            updateBilling(editingRecord.id, input);
          } else {
            createBilling(input);
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
        onConfirm={() => {
          if (!deletingRecord) return;
          deleteBilling(deletingRecord.id);
          toast.success(t("billing.deletedToast"));
          setDeletingRecord(undefined);
        }}
      />
    </div>
  );
}
