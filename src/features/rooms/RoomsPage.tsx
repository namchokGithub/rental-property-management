import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DoorOpen, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SearchInput } from "@/components/common/SearchInput";
import { RoomTable } from "@/features/rooms/RoomTable";
import { RoomFormDialog } from "@/features/rooms/RoomFormDialog";
import { RoomDetailSheet } from "@/features/rooms/RoomDetailSheet";
import { AssignTenantDialog } from "@/features/assignments/AssignTenantDialog";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useAssignments } from "@/hooks/useAssignments";
import { useLanguage } from "@/i18n";
import { billingRepository } from "@/data/repositories/billingRepository";
import { matchesSearch } from "@/lib/search";
import type { Room } from "@/types/room";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RoomsPage() {
  const { t } = useLanguage();
  const { rooms, createRoom, updateRoom, deleteRoom } = useRooms();
  const { tenants } = useTenants();
  const { assignments, assignTenant, endTenancyByRoomId, getActiveByTenantId } = useAssignments();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined);
  const [detailRoom, setDetailRoom] = useState<Room | undefined>(undefined);
  const [deletingRoom, setDeletingRoom] = useState<Room | undefined>(undefined);
  const [assigningRoom, setAssigningRoom] = useState<Room | undefined>(undefined);
  const [endingTenancyRoom, setEndingTenancyRoom] = useState<Room | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

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
      if (tenant) map[roomId] = `${tenant.firstName} ${tenant.lastName}`;
    }
    return map;
  }, [activeAssignmentByRoomId, tenants]);

  const detailAssignment = detailRoom ? activeAssignmentByRoomId.get(detailRoom.id) : undefined;
  const detailTenant = detailAssignment ? tenants.find((t) => t.id === detailAssignment.tenantId) : undefined;
  const detailBillingHistory = detailRoom ? billingRepository.getByRoomId(detailRoom.id) : [];

  const availableTenants = tenants.filter((t) => t.status === "active" && !getActiveByTenantId(t.id));

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) =>
        matchesSearch(searchQuery, room.roomNumber, room.floor, room.type, tenantNameByRoomId[room.id])
      ),
    [rooms, searchQuery, tenantNameByRoomId]
  );

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
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("common.search")}
            className="w-full sm:max-w-sm"
          />
          {filteredRooms.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t("common.noResultsTitle")}
              description={t("common.noResultsDescription", { query: searchQuery })}
              actionLabel={t("common.clearSearch")}
              onAction={() => setSearchQuery("")}
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
        onSubmit={(input) => {
          if (editingRoom) {
            updateRoom(editingRoom.id, input);
          } else {
            createRoom(input);
          }
        }}
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
        onAssign={({ roomId, tenantId, startDate }) => {
          assignTenant({ roomId, tenantId, startDate });
          toast.success(t("room.assignedToast"));
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
        onConfirm={() => {
          if (!deletingRoom) return;
          deleteRoom(deletingRoom.id);
          toast.success(t("room.deletedToast"));
          setDeletingRoom(undefined);
        }}
      />

      <ConfirmDialog
        open={endingTenancyRoom !== undefined}
        onOpenChange={(open) => !open && setEndingTenancyRoom(undefined)}
        title={t("room.endTenancyTitle")}
        description={t("room.endTenancyDescription", { roomNumber: endingTenancyRoom?.roomNumber ?? "" })}
        confirmLabel={t("room.endTenancy")}
        onConfirm={() => {
          if (!endingTenancyRoom) return;
          endTenancyByRoomId(endingTenancyRoom.id, today());
          toast.success(t("room.tenancyEndedToast"));
          setEndingTenancyRoom(undefined);
        }}
      />
    </div>
  );
}
