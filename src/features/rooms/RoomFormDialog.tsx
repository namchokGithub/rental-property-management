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
import { useLanguage } from "@/i18n";
import { validateRoom, type ValidationErrors } from "@/lib/validation";
import type { Room, CreateRoomInput, RoomStatus } from "@/types/room";

interface RoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: Room;
  rooms: Room[];
  onSubmit: (input: CreateRoomInput) => Promise<unknown>;
}

interface FormState {
  roomNumber: string;
  floor: string;
  type: string;
  monthlyRent: string;
  status: RoomStatus;
  description: string;
}

function toFormState(room: Room | undefined): FormState {
  return {
    roomNumber: room?.roomNumber ?? "",
    floor: room?.floor ?? "",
    type: room?.type ?? "",
    monthlyRent: room ? String(room.monthlyRent) : "",
    status: room?.status ?? "available",
    description: room?.description ?? "",
  };
}

const STATUS_OPTIONS: RoomStatus[] = ["available", "occupied", "maintenance", "inactive"];

export function RoomFormDialog({ open, onOpenChange, room, rooms, onSubmit }: RoomFormDialogProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>(() => toFormState(room));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(toFormState(room));
      setErrors({});
    }
    onOpenChange(next);
  }

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    const input: CreateRoomInput = {
      roomNumber: form.roomNumber.trim(),
      floor: form.floor.trim() || undefined,
      type: form.type.trim() || undefined,
      monthlyRent: Number(form.monthlyRent) || 0,
      status: form.status,
      description: form.description.trim() || undefined,
    };
    const existingRoomNumbers = new Set(
      rooms.filter((r) => r.id !== room?.id).map((r) => r.roomNumber.trim().toLowerCase())
    );
    const validationErrors = validateRoom(input, existingRoomNumbers);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(input);
      toast.success(room ? t("room.updatedToast") : t("room.createdToast"));
      onOpenChange(false);
    } catch {
      toast.error(t("common.actionFailed"));
    } finally {
      setIsSubmitting(false);
    }
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
              onChange={(e) => {
                setForm({ ...form, roomNumber: e.target.value });
                clearError("roomNumber");
              }}
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
              onChange={(e) => {
                setForm({ ...form, monthlyRent: e.target.value });
                clearError("monthlyRent");
              }}
            />
            {errors.monthlyRent && <p className="text-xs text-destructive">{t(errors.monthlyRent)}</p>}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {room ? t("common.saveChanges") : t("room.addRoom")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
