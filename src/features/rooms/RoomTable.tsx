import { Eye, Pencil, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/common/StatusBadge";
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
}

export function RoomTable({ rooms, tenantNameByRoomId, onView, onEdit, onDelete, onAssign, onEndTenancy }: RoomTableProps) {
  const { t, language } = useLanguage();
  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("room.roomNumber")}</TableHead>
            <TableHead>{t("room.floor")}</TableHead>
            <TableHead>{t("room.type")}</TableHead>
            <TableHead>{t("common.tenant")}</TableHead>
            <TableHead>{t("room.monthlyRent")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(room)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">{t("common.edit")}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("common.edit")}</TooltipContent>
                    </Tooltip>
                    {tenantName ? (
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
                    )}
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
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
