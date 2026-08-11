import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DoorOpen, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SearchInput } from "@/components/common/SearchInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSpinner } from "@/components/common/PageSpinner";
import { RoomTable } from "@/features/rooms/RoomTable";
import { RoomFormDialog } from "@/features/rooms/RoomFormDialog";
import { RoomDetailSheet } from "@/features/rooms/RoomDetailSheet";
import { AssignTenantDialog } from "@/features/assignments/AssignTenantDialog";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useAssignments } from "@/hooks/useAssignments";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useLanguage } from "@/i18n";
import { RoomHasActiveAssignmentError } from "@/data/repositories/roomRepository";
import { matchesSearch } from "@/lib/search";
import type { Room, RoomStatus } from "@/types/room";

const ROOM_STATUSES: RoomStatus[] = ["available", "occupied", "maintenance", "inactive"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RoomsPage() {
  const { t } = useLanguage();
  const { rooms, isLoading, createRoom, updateRoom, deleteRoom } = useRooms();
  const { tenants } = useTenants();
  const { assignments, assignTenant, endTenancyByRoomId, getActiveByTenantId } = useAssignments();
  const { records: billingRecords } = useBillingRecords();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined);
  const [detailRoom, setDetailRoom] = useState<Room | undefined>(undefined);
  const [deletingRoom, setDeletingRoom] = useState<Room | undefined>(undefined);
  const [assigningRoom, setAssigningRoom] = useState<Room | undefined>(undefined);
  const [endingTenancyRoom, setEndingTenancyRoom] = useState<Room | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RoomStatus | "all">("all");

  const activeAssignmentByRoomId = useMemo(() => {
    const map = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments) {
      if (a.status === "active") map.set(a.roomId, a);
    }
    return map;
  }, [assignments]);

  const tenantNameByRoomId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [roomId, assignment] of activeAssignmentByRoomId) {
      const tenant = tenants.find((t) => t.id === assignment.tenantId);
      if (tenant) map[roomId] = tenant.name;
    }
    return map;
  }, [activeAssignmentByRoomId, tenants]);

  const detailAssignment = detailRoom ? activeAssignmentByRoomId.get(detailRoom.id) : undefined;
  const detailTenant = detailAssignment ? tenants.find((t) => t.id === detailAssignment.tenantId) : undefined;
  const detailBillingHistory = detailRoom ? billingRecords.filter((r) => r.roomId === detailRoom.id) : [];

  const availableTenants = tenants.filter((t) => t.status === "active" && !getActiveByTenantId(t.id));

  const filteredRooms = useMemo(
    () =>
      rooms
        .filter((room) => statusFilter === "all" || room.status === statusFilter)
        .filter((room) =>
          matchesSearch(searchQuery, room.roomNumber, room.floor, room.type, tenantNameByRoomId[room.id])
        ),
    [rooms, searchQuery, statusFilter, tenantNameByRoomId]
  );

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("room.title")}
        description={t("room.description")}
        actions={
          <Button
            onClick={() => {
              setEditingRoom(undefined);
              setFormOpen(true);
            }}
          >
            <Plus /> {t("room.addRoom")}
          </Button>
        }
      />

      {rooms.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title={t("room.noRoomsTitle")}
          description={t("room.noRoomsDescription")}
          actionLabel={t("room.addRoom")}
          onAction={() => {
            setEditingRoom(undefined);
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
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as RoomStatus | "all")}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
                {ROOM_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredRooms.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t("common.noResultsTitle")}
              description={t("common.noResultsDescription", { query: searchQuery })}
              actionLabel={t("common.clearSearch")}
              onAction={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
            />
          ) : (
            <RoomTable
              rooms={filteredRooms}
              tenantNameByRoomId={tenantNameByRoomId}
              onView={setDetailRoom}
              onEdit={(room) => {
                setEditingRoom(room);
                setFormOpen(true);
              }}
              onDelete={setDeletingRoom}
              onAssign={setAssigningRoom}
              onEndTenancy={setEndingTenancyRoom}
            />
          )}
        </>
      )}

      <RoomFormDialog
        key={editingRoom?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        room={editingRoom}
        onSubmit={(input) => (editingRoom ? updateRoom(editingRoom.id, input) : createRoom(input))}
      />

      <RoomDetailSheet
        open={detailRoom !== undefined}
        onOpenChange={(open) => !open && setDetailRoom(undefined)}
        room={detailRoom}
        tenant={detailTenant}
        assignment={detailAssignment}
        billingHistory={detailBillingHistory}
      />

      <AssignTenantDialog
        open={assigningRoom !== undefined}
        onOpenChange={(open) => !open && setAssigningRoom(undefined)}
        mode="room"
        room={assigningRoom}
        availableRooms={[]}
        availableTenants={availableTenants}
        onAssign={async ({ roomId, tenantId, startDate }) => {
          try {
            await assignTenant({ roomId, tenantId, startDate });
            toast.success(t("room.assignedToast"));
          } catch {
            toast.error(t("common.actionFailed"));
          }
        }}
      />

      <ConfirmDialog
        open={deletingRoom !== undefined}
        onOpenChange={(open) => !open && setDeletingRoom(undefined)}
        title={t("room.deleteConfirmTitle", { roomNumber: deletingRoom?.roomNumber ?? "" })}
        description={
          deletingRoom && tenantNameByRoomId[deletingRoom.id]
            ? t("room.deleteConfirmDescriptionWithTenant", { roomNumber: deletingRoom.roomNumber })
            : t("room.deleteConfirmDescription", { roomNumber: deletingRoom?.roomNumber ?? "" })
        }
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          if (!deletingRoom) return;
          try {
            await deleteRoom(deletingRoom.id);
            toast.success(t("room.deletedToast"));
            setDeletingRoom(undefined);
          } catch (error) {
            toast.error(
              error instanceof RoomHasActiveAssignmentError
                ? t("room.deleteBlockedActiveAssignment")
                : t("common.actionFailed")
            );
          }
        }}
      />

      <ConfirmDialog
        open={endingTenancyRoom !== undefined}
        onOpenChange={(open) => !open && setEndingTenancyRoom(undefined)}
        title={t("room.endTenancyTitle")}
        description={t("room.endTenancyDescription", { roomNumber: endingTenancyRoom?.roomNumber ?? "" })}
        confirmLabel={t("room.endTenancy")}
        onConfirm={async () => {
          if (!endingTenancyRoom) return;
          try {
            await endTenancyByRoomId(endingTenancyRoom.id, today());
            toast.success(t("room.tenancyEndedToast"));
            setEndingTenancyRoom(undefined);
          } catch {
            toast.error(t("common.actionFailed"));
          }
        }}
      />
    </div>
  );
}
