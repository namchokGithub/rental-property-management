import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SearchInput } from "@/components/common/SearchInput";
import { BillingTable } from "@/features/billing/BillingTable";
import { BillingFormDialog } from "@/features/billing/BillingFormDialog";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useAssignments } from "@/hooks/useAssignments";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/i18n";
import { matchesSearch } from "@/lib/search";
import { formatBillingMonth } from "@/lib/date";
import type { BillingRecord } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";

export function BillingPage() {
  const { t, language } = useLanguage();
  const { records, createBilling, updateBilling, deleteBilling } = useBillingRecords();
  const { rooms } = useRooms();
  const { tenants } = useTenants();
  const { assignments } = useAssignments();
  const { settings } = useSettings();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingRecord | undefined>(undefined);
  const [deletingRecord, setDeletingRecord] = useState<BillingRecord | undefined>(undefined);
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

  const activeAssignments = assignments.filter((a) => a.status === "active");

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.billingMonth.localeCompare(a.billingMonth) || b.createdAt.localeCompare(a.createdAt)),
    [records]
  );

  const filteredRecords = useMemo(
    () =>
      sortedRecords.filter((record) => {
        const room = roomById[record.roomId];
        const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
        return matchesSearch(
          searchQuery,
          room?.roomNumber,
          tenant ? `${tenant.firstName} ${tenant.lastName}` : undefined,
          record.invoiceNumber,
          record.billingMonth,
          formatBillingMonth(record.billingMonth, language)
        );
      }),
    [sortedRecords, searchQuery, roomById, tenantById, language]
  );

  function getLatestByRoomId(roomId: string): BillingRecord | undefined {
    return records
      .filter((r) => r.roomId === roomId)
      .sort((a, b) => b.billingMonth.localeCompare(a.billingMonth))[0];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("billing.title")}
        description={t("billing.description")}
        actions={
          <Button
            onClick={() => {
              setEditingRecord(undefined);
              setFormOpen(true);
            }}
          >
            <Plus /> {t("billing.createBilling")}
          </Button>
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
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("common.search")}
            className="w-full sm:max-w-sm"
          />
          {filteredRecords.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t("common.noResultsTitle")}
              description={t("common.noResultsDescription", { query: searchQuery })}
              actionLabel={t("common.clearSearch")}
              onAction={() => setSearchQuery("")}
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
