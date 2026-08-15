import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DoorOpen, Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SearchInput } from "@/components/common/SearchInput";
import { Pagination } from "@/components/common/Pagination";
import { FilterButton } from "@/components/common/FilterButton";
import { SortButton } from "@/components/common/SortButton";
import { PageSpinner } from "@/components/common/PageSpinner";
import { usePagination } from "@/hooks/usePagination";
import { RoomTable } from "@/features/rooms/RoomTable";
import { RoomFormDialog } from "@/features/rooms/RoomFormDialog";
import { RoomImportDialog } from "@/features/rooms/RoomImportDialog";
import { RoomDetailSheet } from "@/features/rooms/RoomDetailSheet";
import { AssignTenantDialog } from "@/features/assignments/AssignTenantDialog";
import { useAuth } from "@/auth";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useAssignments } from "@/hooks/useAssignments";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useLanguage } from "@/i18n";
import { RoomHasActiveAssignmentError } from "@/data/repositories/roomRepository";
import { matchesSearch } from "@/lib/search";
import { compareSortValues, type SortDirection } from "@/lib/sort";
import { type Room, type RoomStatus } from "@/types/room";
import type { RoomSortKey } from "@/features/rooms/RoomTable";

const ROOM_STATUSES: RoomStatus[] = ["available", "occupied", "maintenance", "inactive"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RoomsPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { rooms, isLoading, createRoom, updateRoom, deleteRoom } = useRooms();
  const { tenants } = useTenants();
  const { assignments, assignTenant, endTenancyByRoomId, getActiveByTenantId } = useAssignments();
  const { records: billingRecords } = useBillingRecords();

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined);
  const [detailRoom, setDetailRoom] = useState<Room | undefined>(undefined);
  const [deletingRoom, setDeletingRoom] = useState<Room | undefined>(undefined);
  const [assigningRoom, setAssigningRoom] = useState<Room | undefined>(undefined);
  const [endingTenancyRoom, setEndingTenancyRoom] = useState<Room | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RoomStatus | "all">("all");
  const [sort, setSort] = useState<{ key: RoomSortKey; direction: SortDirection }>({ key: "roomNumber", direction: "asc" });

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

  const sortedRooms = useMemo(
    () =>
      [...filteredRooms].sort((left, right) => {
        const value = (room: Room) => {
          switch (sort.key) {
            case "floor": return room.floor;
            case "tenant": return tenantNameByRoomId[room.id];
            case "monthlyRent": return room.monthlyRent;
            case "status": return t(`status.${room.status}`);
            default: return room.roomNumber;
          }
        };
        return compareSortValues(value(left), value(right), sort.direction, language);
      }),
    [filteredRooms, sort, tenantNameByRoomId, language, t]
  );

  const { page, setPage, pageSize, setPageSize, totalPages, totalItems, pageItems } = usePagination(sortedRooms);

  function handleSort(key: RoomSortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
    setPage(1);
  }

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("room.title")}
        description={t("room.description")}
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload /> {t("room.importRooms")}
              </Button>
              <Button
                onClick={() => {
                  setEditingRoom(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus /> {t("room.addRoom")}
              </Button>
            </div>
          )
        }
      />

      {rooms.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title={t("room.noRoomsTitle")}
          description={t("room.noRoomsDescription")}
          actionLabel={isAdmin ? t("room.addRoom") : undefined}
          onAction={
            isAdmin
              ? () => {
                  setEditingRoom(undefined);
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
                      ...ROOM_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
                    ],
                  },
                ]}
                values={{ status: statusFilter }}
                onApply={(values) => {
                  setStatusFilter((values.status as RoomStatus | "all") ?? "all");
                  setPage(1);
                }}
              />
              <SortButton
                className="md:hidden"
                fields={[
                  { key: "roomNumber", label: t("room.roomNumber") },
                  { key: "floor", label: t("room.floor") },
                  { key: "tenant", label: t("common.tenant") },
                  { key: "monthlyRent", label: t("room.monthlyRent") },
                  { key: "status", label: t("common.status") },
                ]}
                value={sort}
                onApply={(value) => {
                  setSort({ key: value.key as RoomSortKey, direction: value.direction });
                  setPage(1);
                }}
              />
            </div>
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
                setPage(1);
              }}
            />
          ) : (
            <>
              <RoomTable
                rooms={pageItems}
                tenantNameByRoomId={tenantNameByRoomId}
                onView={setDetailRoom}
                onEdit={(room) => {
                  setEditingRoom(room);
                  setFormOpen(true);
                }}
                onDelete={setDeletingRoom}
                onAssign={setAssigningRoom}
                onEndTenancy={setEndingTenancyRoom}
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

      <RoomFormDialog
        key={editingRoom?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        room={editingRoom}
        rooms={rooms}
        onSubmit={(input) => (editingRoom ? updateRoom(editingRoom.id, input) : createRoom(input))}
      />

      <RoomImportDialog open={importOpen} onOpenChange={setImportOpen} rooms={rooms} createRoom={createRoom} />

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
