import { Eye, Pencil, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/auth";
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

function TenantCard({
  tenant,
  room,
  assignment,
  isAdmin,
  onView,
  onEdit,
  onDelete,
  onAssign,
  t,
  language,
}: {
  tenant: Tenant;
  room: Room | undefined;
  assignment: RoomTenantAssignment | undefined;
  isAdmin: boolean;
  onView: (tenant: Tenant) => void;
  onEdit: (tenant: Tenant) => void;
  onDelete: (tenant: Tenant) => void;
  onAssign: (tenant: Tenant) => void;
  t: (key: string) => string;
  language: Parameters<typeof formatDate>[1];
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{tenant.name}</p>
          <StatusBadge status={tenant.status} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <p>
            {t("common.phone")}: {tenant.phone ?? "—"}
          </p>
          <p>
            {t("tenant.currentRoom")}: {room?.roomNumber ?? "—"}
          </p>
          <p>
            {t("room.leaseStart")}: {assignment ? formatDate(assignment.startDate, language) : "—"}
          </p>
          <p>
            {t("room.leaseEnd")}: {assignment?.endDate ? formatDate(assignment.endDate, language) : "—"}
          </p>
        </div>
        <div className="flex items-center justify-end gap-1 border-t pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(tenant)}>
                <Eye className="h-4 w-4" />
                <span className="sr-only">{t("common.view")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.view")}</TooltipContent>
          </Tooltip>
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(tenant)}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{t("common.edit")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.edit")}</TooltipContent>
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAssign(tenant)}>
                  <UserCog className="h-4 w-4" />
                  <span className="sr-only">{room ? t("tenant.moveRoom") : t("tenant.assignRoom")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{room ? t("tenant.moveRoom") : t("tenant.assignRoom")}</TooltipContent>
            </Tooltip>
          )}
          {isAdmin && (
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
          )}
        </div>
      </CardContent>
    </Card>
  );
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <>
      <div className="hidden w-full overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
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
                  {tenant.name}
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
                    {isAdmin && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(tenant)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">{t("common.edit")}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.edit")}</TooltipContent>
                      </Tooltip>
                    )}
                    {isAdmin && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAssign(tenant)}>
                            <UserCog className="h-4 w-4" />
                            <span className="sr-only">{room ? t("tenant.moveRoom") : t("tenant.assignRoom")}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{room ? t("tenant.moveRoom") : t("tenant.assignRoom")}</TooltipContent>
                      </Tooltip>
                    )}
                    {isAdmin && (
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
        {tenants.map((tenant) => {
          const assignment = activeAssignmentByTenantId[tenant.id];
          const room = assignment ? roomById[assignment.roomId] : undefined;
          return (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              room={room}
              assignment={assignment}
              isAdmin={isAdmin}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onAssign={onAssign}
              t={t}
              language={language}
            />
          );
        })}
      </div>
    </>
  );
}
