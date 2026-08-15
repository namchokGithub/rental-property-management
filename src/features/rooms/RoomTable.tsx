import { Eye, Pencil, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SortableTableHead } from "@/components/common/SortableTableHead";
import type { SortDirection } from "@/lib/sort";
import { useAuth } from "@/auth";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import type { Room } from "@/types/room";

interface RoomTableProps {
  rooms: Room[];
  tenantNameByRoomId: Record<string, string>;
  onView: (room: Room) => void;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
  onAssign: (room: Room) => void;
  onEndTenancy: (room: Room) => void;
  sort: { key: RoomSortKey; direction: SortDirection };
  onSort: (key: RoomSortKey) => void;
}

export type RoomSortKey = "roomNumber" | "floor" | "tenant" | "monthlyRent" | "status";

function RoomCard({
  room,
  tenantName,
  isAdmin,
  onView,
  onEdit,
  onDelete,
  onAssign,
  onEndTenancy,
  t,
  language,
}: {
  room: Room;
  tenantName: string | undefined;
  isAdmin: boolean;
  onView: (room: Room) => void;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
  onAssign: (room: Room) => void;
  onEndTenancy: (room: Room) => void;
  t: (key: string) => string;
  language: Parameters<typeof formatCurrency>[1];
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{room.roomNumber}</p>
          <StatusBadge status={room.status} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <p>
            {t("room.floor")}: {room.floor ?? "—"}
          </p>
          <p>
            {t("room.type")}: {room.type ?? "—"}
          </p>
          <p>
            {t("common.tenant")}: {tenantName ?? t("common.noTenant")}
          </p>
          <p>
            {t("room.monthlyRent")}: {formatCurrency(room.monthlyRent, language)}
          </p>
        </div>
        <div className="flex items-center justify-end gap-1 border-t pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(room)}>
                <Eye className="h-4 w-4" />
                <span className="sr-only">{t("common.view")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.view")}</TooltipContent>
          </Tooltip>
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(room)}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{t("common.edit")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.edit")}</TooltipContent>
            </Tooltip>
          )}
          {isAdmin &&
            (tenantName ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEndTenancy(room)}>
                    <UserMinus className="h-4 w-4" />
                    <span className="sr-only">{t("room.endTenancy")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("room.endTenancy")}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAssign(room)}>
                    <UserPlus className="h-4 w-4" />
                    <span className="sr-only">{t("room.assignTenant")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("room.assignTenant")}</TooltipContent>
              </Tooltip>
            ))}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(room)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t("common.delete")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.delete")}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function RoomTable({ rooms, tenantNameByRoomId, onView, onEdit, onDelete, onAssign, onEndTenancy, sort, onSort }: RoomTableProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <>
      <div className="hidden w-full overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead label={t("room.roomNumber")} active={sort.key === "roomNumber"} direction={sort.direction} onSort={() => onSort("roomNumber")} />
              <SortableTableHead label={t("room.floor")} active={sort.key === "floor"} direction={sort.direction} onSort={() => onSort("floor")} />
              <TableHead>{t("room.type")}</TableHead>
              <SortableTableHead label={t("common.tenant")} active={sort.key === "tenant"} direction={sort.direction} onSort={() => onSort("tenant")} />
              <SortableTableHead label={t("room.monthlyRent")} active={sort.key === "monthlyRent"} direction={sort.direction} onSort={() => onSort("monthlyRent")} />
              <SortableTableHead label={t("common.status")} active={sort.key === "status"} direction={sort.direction} onSort={() => onSort("status")} />
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => {
              const tenantName = tenantNameByRoomId[room.id];
              return (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.roomNumber}</TableCell>
                  <TableCell>{room.floor ?? "—"}</TableCell>
                  <TableCell>{room.type ?? "—"}</TableCell>
                  <TableCell>{tenantName ?? "—"}</TableCell>
                  <TableCell>{formatCurrency(room.monthlyRent, language)}</TableCell>
                  <TableCell>
                    <StatusBadge status={room.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(room)}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">{t("common.view")}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.view")}</TooltipContent>
                      </Tooltip>
                      {isAdmin && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(room)}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">{t("common.edit")}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("common.edit")}</TooltipContent>
                        </Tooltip>
                      )}
                      {isAdmin &&
                        (tenantName ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEndTenancy(room)}>
                                <UserMinus className="h-4 w-4" />
                                <span className="sr-only">{t("room.endTenancy")}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("room.endTenancy")}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAssign(room)}>
                                <UserPlus className="h-4 w-4" />
                                <span className="sr-only">{t("room.assignTenant")}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("room.assignTenant")}</TooltipContent>
                          </Tooltip>
                        ))}
                      {isAdmin && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => onDelete(room)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">{t("common.delete")}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("common.delete")}</TooltipContent>
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
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            tenantName={tenantNameByRoomId[room.id]}
            isAdmin={isAdmin}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onAssign={onAssign}
            onEndTenancy={onEndTenancy}
            t={t}
            language={language}
          />
        ))}
      </div>
    </>
  );
}
