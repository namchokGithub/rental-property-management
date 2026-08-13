import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SearchInput } from "@/components/common/SearchInput";
import { Pagination } from "@/components/common/Pagination";
import { FilterButton } from "@/components/common/FilterButton";
import { PageSpinner } from "@/components/common/PageSpinner";
import { usePagination } from "@/hooks/usePagination";
import { TenantTable } from "@/features/tenants/TenantTable";
import { TenantFormDialog } from "@/features/tenants/TenantFormDialog";
import { TenantDetailSheet } from "@/features/tenants/TenantDetailSheet";
import { AssignTenantDialog } from "@/features/assignments/AssignTenantDialog";
import { useAuth } from "@/auth";
import { useTenants } from "@/hooks/useTenants";
import { useRooms } from "@/hooks/useRooms";
import { useAssignments } from "@/hooks/useAssignments";
import { useLanguage } from "@/i18n";
import { matchesSearch } from "@/lib/search";
import { TenantHasActiveAssignmentError } from "@/data/repositories/tenantRepository";
import type { Tenant, TenantStatus } from "@/types/tenant";
import type { RoomTenantAssignment } from "@/types/assignment";

const TENANT_STATUSES: TenantStatus[] = ["active", "inactive"];

export function TenantsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { tenants, isLoading, createTenant, updateTenant, deleteTenant } = useTenants();
  const { rooms } = useRooms();
  const { assignments, assignTenant, endTenancyByRoomId, getActiveByTenantId } = useAssignments();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | undefined>(undefined);
  const [detailTenant, setDetailTenant] = useState<Tenant | undefined>(undefined);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | undefined>(undefined);
  const [assigningTenant, setAssigningTenant] = useState<Tenant | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenantStatus | "all">("all");

  const activeAssignmentByTenantId = useMemo(() => {
    const map: Record<string, RoomTenantAssignment> = {};
    for (const a of assignments) {
      if (a.status === "active") map[a.tenantId] = a;
    }
    return map;
  }, [assignments]);

  const roomById = useMemo(() => {
    const map: Record<string, (typeof rooms)[number]> = {};
    for (const room of rooms) map[room.id] = room;
    return map;
  }, [rooms]);

  const detailAssignment = detailTenant ? activeAssignmentByTenantId[detailTenant.id] : undefined;
  const detailRoom = detailAssignment ? roomById[detailAssignment.roomId] : undefined;

  const availableRooms = rooms.filter((r) => r.status === "available");

  const filteredTenants = useMemo(
    () =>
      tenants
        .filter((tenant) => statusFilter === "all" || tenant.status === statusFilter)
        .filter((tenant) => {
          const assignment = activeAssignmentByTenantId[tenant.id];
          const room = assignment ? roomById[assignment.roomId] : undefined;
          return matchesSearch(searchQuery, tenant.name, tenant.phone, room?.roomNumber);
        }),
    [tenants, searchQuery, statusFilter, activeAssignmentByTenantId, roomById]
  );

  const { page, setPage, pageSize, setPageSize, totalPages, totalItems, pageItems } = usePagination(filteredTenants);

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tenant.title")}
        description={t("tenant.description")}
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setEditingTenant(undefined);
                setFormOpen(true);
              }}
            >
              <Plus /> {t("tenant.addTenant")}
            </Button>
          )
        }
      />

      {tenants.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("tenant.noTenantsTitle")}
          description={t("tenant.noTenantsDescription")}
          actionLabel={isAdmin ? t("tenant.addTenant") : undefined}
          onAction={
            isAdmin
              ? () => {
                  setEditingTenant(undefined);
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
            <FilterButton
              fields={[
                {
                  key: "status",
                  label: t("common.status"),
                  options: [
                    { value: "all", label: t("common.allStatuses") },
                    ...TENANT_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
                  ],
                },
              ]}
              values={{ status: statusFilter }}
              onApply={(values) => {
                setStatusFilter((values.status as TenantStatus | "all") ?? "all");
                setPage(1);
              }}
            />
          </div>
          {filteredTenants.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t("common.noResultsTitle")}
              description={t("common.noResultsDescription", { query: searchQuery })}
              actionLabel={t("common.clearSearch")}
              onAction={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setPage(1);
              }}
            />
          ) : (
            <>
              <TenantTable
                tenants={pageItems}
                activeAssignmentByTenantId={activeAssignmentByTenantId}
                roomById={roomById}
                onView={setDetailTenant}
                onEdit={(tenant) => {
                  setEditingTenant(tenant);
                  setFormOpen(true);
                }}
                onDelete={setDeletingTenant}
                onAssign={setAssigningTenant}
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

      <TenantFormDialog
        key={editingTenant?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        tenant={editingTenant}
        onSubmit={(input) => (editingTenant ? updateTenant(editingTenant.id, input) : createTenant(input))}
      />

      <TenantDetailSheet
        open={detailTenant !== undefined}
        onOpenChange={(open) => !open && setDetailTenant(undefined)}
        tenant={detailTenant}
        currentRoom={detailRoom}
        assignment={detailAssignment}
      />

      <AssignTenantDialog
        open={assigningTenant !== undefined}
        onOpenChange={(open) => !open && setAssigningTenant(undefined)}
        mode="tenant"
        tenant={assigningTenant}
        availableRooms={availableRooms}
        availableTenants={[]}
        onAssign={async ({ roomId, tenantId, startDate }) => {
          try {
            const existing = getActiveByTenantId(tenantId);
            if (existing && existing.roomId !== roomId) {
              // Awaited so the old tenancy is fully ended (assignTenant's own
              // transaction otherwise races it and sees the tenant as still
              // actively assigned — see assignmentRepository.ts).
              await endTenancyByRoomId(existing.roomId, startDate);
            }
            await assignTenant({ roomId, tenantId, startDate });
            toast.success(t("tenant.roomAssignedToast"));
          } catch {
            toast.error(t("common.actionFailed"));
          }
        }}
      />

      <ConfirmDialog
        open={deletingTenant !== undefined}
        onOpenChange={(open) => !open && setDeletingTenant(undefined)}
        title={t("tenant.deleteConfirmTitle", {
          name: deletingTenant?.name ?? "",
        })}
        description={t("tenant.deleteConfirmDescription")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          if (!deletingTenant) return;
          try {
            await deleteTenant(deletingTenant.id);
            toast.success(t("tenant.deletedToast"));
            setDeletingTenant(undefined);
          } catch (error) {
            toast.error(
              error instanceof TenantHasActiveAssignmentError
                ? t("tenant.deleteBlockedActiveAssignment")
                : t("common.actionFailed")
            );
          }
        }}
      />
    </div>
  );
}
