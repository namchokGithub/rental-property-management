import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SearchInput } from "@/components/common/SearchInput";
import { TenantTable } from "@/features/tenants/TenantTable";
import { TenantFormDialog } from "@/features/tenants/TenantFormDialog";
import { TenantDetailSheet } from "@/features/tenants/TenantDetailSheet";
import { AssignTenantDialog } from "@/features/assignments/AssignTenantDialog";
import { useTenants } from "@/hooks/useTenants";
import { useRooms } from "@/hooks/useRooms";
import { useAssignments } from "@/hooks/useAssignments";
import { useLanguage } from "@/i18n";
import { matchesSearch } from "@/lib/search";
import type { Tenant } from "@/types/tenant";
import type { RoomTenantAssignment } from "@/types/assignment";

export function TenantsPage() {
  const { t } = useLanguage();
  const { tenants, createTenant, updateTenant, deleteTenant } = useTenants();
  const { rooms } = useRooms();
  const { assignments, assignTenant, endTenancyByRoomId, getActiveByTenantId } = useAssignments();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | undefined>(undefined);
  const [detailTenant, setDetailTenant] = useState<Tenant | undefined>(undefined);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | undefined>(undefined);
  const [assigningTenant, setAssigningTenant] = useState<Tenant | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

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
      tenants.filter((tenant) => {
        const assignment = activeAssignmentByTenantId[tenant.id];
        const room = assignment ? roomById[assignment.roomId] : undefined;
        return matchesSearch(searchQuery, tenant.firstName, tenant.lastName, tenant.phone, room?.roomNumber);
      }),
    [tenants, searchQuery, activeAssignmentByTenantId, roomById]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tenant.title")}
        description={t("tenant.description")}
        actions={
          <Button
            onClick={() => {
              setEditingTenant(undefined);
              setFormOpen(true);
            }}
          >
            <Plus /> {t("tenant.addTenant")}
          </Button>
        }
      />

      {tenants.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("tenant.noTenantsTitle")}
          description={t("tenant.noTenantsDescription")}
          actionLabel={t("tenant.addTenant")}
          onAction={() => {
            setEditingTenant(undefined);
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
          {filteredTenants.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t("common.noResultsTitle")}
              description={t("common.noResultsDescription", { query: searchQuery })}
              actionLabel={t("common.clearSearch")}
              onAction={() => setSearchQuery("")}
            />
          ) : (
            <TenantTable
              tenants={filteredTenants}
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
          )}
        </>
      )}

      <TenantFormDialog
        key={editingTenant?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        tenant={editingTenant}
        onSubmit={(input) => {
          if (editingTenant) {
            updateTenant(editingTenant.id, input);
          } else {
            createTenant(input);
          }
        }}
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
        onAssign={({ roomId, tenantId, startDate }) => {
          const existing = getActiveByTenantId(tenantId);
          if (existing && existing.roomId !== roomId) {
            endTenancyByRoomId(existing.roomId, startDate);
          }
          assignTenant({ roomId, tenantId, startDate });
          toast.success(t("tenant.roomAssignedToast"));
        }}
      />

      <ConfirmDialog
        open={deletingTenant !== undefined}
        onOpenChange={(open) => !open && setDeletingTenant(undefined)}
        title={t("tenant.deleteConfirmTitle", {
          name: `${deletingTenant?.firstName ?? ""} ${deletingTenant?.lastName ?? ""}`,
        })}
        description={t("tenant.deleteConfirmDescription")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => {
          if (!deletingTenant) return;
          deleteTenant(deletingTenant.id);
          toast.success(t("tenant.deletedToast"));
          setDeletingTenant(undefined);
        }}
      />
    </div>
  );
}
