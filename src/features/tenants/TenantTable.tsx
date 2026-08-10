import { Eye, Pencil, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useLanguage } from "@/i18n";
import { formatDate } from "@/lib/date";
import type { Tenant } from "@/types/tenant";
import type { RoomTenantAssignment } from "@/types/assignment";
import type { Room } from "@/types/room";

interface TenantTableProps {
  tenants: Tenant[];
  activeAssignmentByTenantId: Record<string, RoomTenantAssignment>;
  roomById: Record<string, Room>;
  onView: (tenant: Tenant) => void;
  onEdit: (tenant: Tenant) => void;
  onDelete: (tenant: Tenant) => void;
  onAssign: (tenant: Tenant) => void;
}

export function TenantTable({
  tenants,
  activeAssignmentByTenantId,
  roomById,
  onView,
  onEdit,
  onDelete,
  onAssign,
}: TenantTableProps) {
  const { t, language } = useLanguage();
  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.name")}</TableHead>
            <TableHead>{t("common.phone")}</TableHead>
            <TableHead>{t("tenant.currentRoom")}</TableHead>
            <TableHead>{t("room.leaseStart")}</TableHead>
            <TableHead>{t("room.leaseEnd")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => {
            const assignment = activeAssignmentByTenantId[tenant.id];
            const room = assignment ? roomById[assignment.roomId] : undefined;
            return (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">
                  {tenant.firstName} {tenant.lastName}
                </TableCell>
                <TableCell>{tenant.phone ?? "—"}</TableCell>
                <TableCell>{room?.roomNumber ?? "—"}</TableCell>
                <TableCell>{assignment ? formatDate(assignment.startDate, language) : "—"}</TableCell>
                <TableCell>{assignment?.endDate ? formatDate(assignment.endDate, language) : "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={tenant.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(tenant)}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">{t("common.view")}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("common.view")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(tenant)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">{t("common.edit")}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("common.edit")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAssign(tenant)}>
                          <UserCog className="h-4 w-4" />
                          <span className="sr-only">{room ? t("tenant.moveRoom") : t("tenant.assignRoom")}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{room ? t("tenant.moveRoom") : t("tenant.assignRoom")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onDelete(tenant)}
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
