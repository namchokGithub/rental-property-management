import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/i18n";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";

interface AssignTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "room" | "tenant";
  room?: Room;
  tenant?: Tenant;
  availableRooms: Room[];
  availableTenants: Tenant[];
  onAssign: (params: { roomId: string; tenantId: string; startDate: string }) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssignTenantDialog({
  open,
  onOpenChange,
  mode,
  room,
  tenant,
  availableRooms,
  availableTenants,
  onAssign,
}: AssignTenantDialogProps) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(today());

  function handleOpenChange(next: boolean) {
    if (next) {
      setSelectedId("");
      setStartDate(today());
    }
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!selectedId) return;
    if (mode === "room" && room) {
      onAssign({ roomId: room.id, tenantId: selectedId, startDate });
    } else if (mode === "tenant" && tenant) {
      onAssign({ roomId: selectedId, tenantId: tenant.id, startDate });
    }
    onOpenChange(false);
  }

  const title =
    mode === "room"
      ? t("assignment.dialogTitleForRoom", { roomNumber: room?.roomNumber ?? "" })
      : t("assignment.dialogTitleForTenant", { name: tenant?.name ?? "" });
  const options = mode === "room" ? availableTenants : availableRooms;
  const emptyMessage = mode === "room" ? t("assignment.noTenantsAvailable") : t("assignment.noRoomsAvailable");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("assignment.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assign-target">{mode === "room" ? t("common.tenant") : t("common.room")}</Label>
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="assign-target">
                  <SelectValue placeholder={mode === "room" ? t("assignment.selectTenant") : t("assignment.selectRoom")} />
                </SelectTrigger>
                <SelectContent>
                  {mode === "room"
                    ? availableTenants.map((tenantOption) => (
                        <SelectItem key={tenantOption.id} value={tenantOption.id}>
                          {tenantOption.name}
                        </SelectItem>
                      ))
                    : availableRooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.roomNumber}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-start-date">{t("assignment.startDate")}</Label>
            <DatePicker id="assign-start-date" value={startDate} onChange={setStartDate} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedId}>
            {t("assignment.assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
