import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/i18n";
import { validateRoom, type ValidationErrors } from "@/lib/validation";
import type { Room, CreateRoomInput, RoomStatus } from "@/types/room";

interface RoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: Room;
  onSubmit: (input: CreateRoomInput) => void;
}

interface FormState {
  roomNumber: string;
  floor: string;
  type: string;
  monthlyRent: string;
  electricityRate: string;
  waterRate: string;
  status: RoomStatus;
  description: string;
}

function toFormState(room: Room | undefined, defaults: { electricityRate: number; waterRate: number }): FormState {
  return {
    roomNumber: room?.roomNumber ?? "",
    floor: room?.floor ?? "",
    type: room?.type ?? "",
    monthlyRent: room ? String(room.monthlyRent) : "",
    electricityRate: room ? String(room.electricityRate) : String(defaults.electricityRate),
    waterRate: room ? String(room.waterRate) : String(defaults.waterRate),
    status: room?.status ?? "available",
    description: room?.description ?? "",
  };
}

const STATUS_OPTIONS: RoomStatus[] = ["available", "occupied", "maintenance", "inactive"];

export function RoomFormDialog({ open, onOpenChange, room, onSubmit }: RoomFormDialogProps) {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const [form, setForm] = useState<FormState>(() =>
    toFormState(room, { electricityRate: settings.defaultElectricityRate, waterRate: settings.defaultWaterRate })
  );
  const [errors, setErrors] = useState<ValidationErrors>({});

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(toFormState(room, { electricityRate: settings.defaultElectricityRate, waterRate: settings.defaultWaterRate }));
      setErrors({});
    }
    onOpenChange(next);
  }

  function handleSubmit() {
    const input: CreateRoomInput = {
      roomNumber: form.roomNumber.trim(),
      floor: form.floor.trim() || undefined,
      type: form.type.trim() || undefined,
      monthlyRent: Number(form.monthlyRent) || 0,
      electricityRate: Number(form.electricityRate) || 0,
      waterRate: Number(form.waterRate) || 0,
      status: form.status,
      description: form.description.trim() || undefined,
    };
    const validationErrors = validateRoom(input);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(input);
    toast.success(room ? t("room.updatedToast") : t("room.createdToast"));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{room ? t("room.editRoom") : t("room.addRoom")}</DialogTitle>
          <DialogDescription>{room ? t("room.editRoomDescription") : t("room.addRoomDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="roomNumber">{t("room.roomNumber")}</Label>
            <Input
              id="roomNumber"
              value={form.roomNumber}
              onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
            />
            {errors.roomNumber && <p className="text-xs text-destructive">{t(errors.roomNumber)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="floor">{t("room.floor")}</Label>
            <Input id="floor" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">{t("room.type")}</Label>
            <Input id="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">{t("common.status")}</Label>
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as RoomStatus })}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthlyRent">{t("room.monthlyRent")}</Label>
            <Input
              id="monthlyRent"
              type="text"
              inputMode="decimal"
              value={form.monthlyRent}
              onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
            />
            {errors.monthlyRent && <p className="text-xs text-destructive">{t(errors.monthlyRent)}</p>}
          </div>
          <div />
          <div className="space-y-1.5">
            <Label htmlFor="electricityRate">{t("room.electricityRate")}</Label>
            <Input
              id="electricityRate"
              type="text"
              inputMode="decimal"
              value={form.electricityRate}
              onChange={(e) => setForm({ ...form, electricityRate: e.target.value })}
            />
            {errors.electricityRate && <p className="text-xs text-destructive">{t(errors.electricityRate)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="waterRate">{t("room.waterRate")}</Label>
            <Input
              id="waterRate"
              type="text"
              inputMode="decimal"
              value={form.waterRate}
              onChange={(e) => setForm({ ...form, waterRate: e.target.value })}
            />
            {errors.waterRate && <p className="text-xs text-destructive">{t(errors.waterRate)}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">{t("room.descriptionLabel")}</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>{room ? t("common.saveChanges") : t("room.addRoom")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
