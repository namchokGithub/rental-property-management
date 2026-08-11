import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/i18n";
import {
  calculateMeterReading,
  calculateBillingTotals,
} from "@/lib/calculations";
import { formatCurrency } from "@/lib/currency";
import { defaultDueDate, formatBillingMonth } from "@/lib/date";
import { BillingAlreadyExistsError } from "@/data/repositories/billingRepository";
import { validateBilling, type ValidationErrors } from "@/lib/validation";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";
import type { RoomTenantAssignment } from "@/types/assignment";
import type {
  BillingRecord,
  BillingCharge,
  CreateBillingInput,
} from "@/types/billing";
import type { PropertySettings } from "@/types/settings";
import type { OtherChargeMaster } from "@/types/otherCharge";
import type { Language } from "@/i18n/types";

interface BillingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  tenants: Tenant[];
  activeAssignments: RoomTenantAssignment[];
  settings: PropertySettings;
  otherCharges: OtherChargeMaster[];
  record?: BillingRecord;
  getLatestByRoomId: (roomId: string) => BillingRecord | undefined;
  onSubmit: (input: CreateBillingInput) => Promise<unknown>;
}

interface ChargeRow {
  key: string;
  masterId?: string;
  name: string;
  amount: string;
}

interface FormState {
  roomId: string;
  tenantId: string;
  billingMonth: string;
  electricityPreviousMeter: string;
  electricityCurrentMeter: string;
  electricityRate: string;
  waterPreviousMeter: string;
  waterCurrentMeter: string;
  waterRate: string;
  rentAmount: string;
  dueDate: string;
  status: "draft" | "issued";
  otherCharges: ChargeRow[];
}

function chargesToRows(charges: BillingCharge[]): ChargeRow[] {
  return charges.map((c) => ({
    key: c.id,
    masterId: c.masterId,
    name: c.name,
    amount: String(c.amount),
  }));
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function buildFormState(params: {
  record?: BillingRecord;
  room?: Room;
  tenantId?: string;
  settings: PropertySettings;
  latest?: BillingRecord;
  otherChargeMasters: OtherChargeMaster[];
  language: Language;
}): FormState {
  const {
    record,
    room,
    tenantId,
    settings,
    latest,
    otherChargeMasters,
    language,
  } = params;
  if (record) {
    return {
      roomId: record.roomId,
      tenantId: record.tenantId ?? "",
      billingMonth: record.billingMonth,
      electricityPreviousMeter: String(record.electricity.previousMeter),
      electricityCurrentMeter: String(record.electricity.currentMeter),
      electricityRate: String(record.electricity.rate),
      waterPreviousMeter: String(record.water.previousMeter),
      waterCurrentMeter: String(record.water.currentMeter),
      waterRate: String(record.water.rate),
      rentAmount: String(record.rentAmount),
      dueDate: record.dueDate ?? "",
      status: record.status === "issued" ? "issued" : "draft",
      otherCharges: chargesToRows(record.otherCharges),
    };
  }
  const billingMonth = currentMonth();
  return {
    roomId: room?.id ?? "",
    tenantId: tenantId ?? "",
    billingMonth,
    electricityPreviousMeter: latest
      ? String(latest.electricity.currentMeter)
      : "0",
    electricityCurrentMeter: "0",
    electricityRate: String(settings.defaultElectricityRate),
    waterPreviousMeter: latest ? String(latest.water.currentMeter) : "0",
    waterCurrentMeter: "0",
    waterRate: String(settings.defaultWaterRate),
    rentAmount: room ? String(room.monthlyRent) : "0",
    dueDate: defaultDueDate(billingMonth),
    status: "draft",
    otherCharges: otherChargeMasters
      .filter((m) => m.isActive)
      .map((m) => ({
        key: crypto.randomUUID(),
        masterId: m.id,
        name: language === "en" && m.nameEn ? m.nameEn : m.nameTh,
        amount: String(m.defaultAmount),
      })),
  };
}

export function BillingFormDialog({
  open,
  onOpenChange,
  rooms,
  tenants,
  activeAssignments,
  settings,
  otherCharges,
  record,
  getLatestByRoomId,
  onSubmit,
}: BillingFormDialogProps) {
  const { t, language } = useLanguage();
  const [form, setForm] = useState<FormState>(() =>
    buildFormState({
      record,
      settings,
      otherChargeMasters: otherCharges,
      language,
    }),
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        buildFormState({
          record,
          settings,
          otherChargeMasters: otherCharges,
          language,
        }),
      );
      setErrors({});
      setSelectedMasterId("");
    }
  }, [open, record, settings, otherCharges, language]);

  const [selectedMasterId, setSelectedMasterId] = useState("");

  const activeMasters = otherCharges.filter((c) => c.isActive);
  const availableMasters = activeMasters.filter(
    (m) => !form.otherCharges.some((c) => c.masterId === m.id),
  );

  function masterDisplayName(master: OtherChargeMaster): string {
    return language === "en" && master.nameEn ? master.nameEn : master.nameTh;
  }

  function addMasterCharge() {
    const master = availableMasters.find((m) => m.id === selectedMasterId);
    if (!master) return;
    setForm({
      ...form,
      otherCharges: [
        ...form.otherCharges,
        {
          key: crypto.randomUUID(),
          masterId: master.id,
          name: masterDisplayName(master),
          amount: String(master.defaultAmount),
        },
      ],
    });
    setSelectedMasterId("");
  }

  function addCustomCharge() {
    setForm({
      ...form,
      otherCharges: [
        ...form.otherCharges,
        { key: crypto.randomUUID(), name: "", amount: "0" },
      ],
    });
  }

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleRoomChange(roomId: string) {
    clearError("roomId");
    if (record) {
      setForm({ ...form, roomId });
      return;
    }
    const room = rooms.find((r) => r.id === roomId);
    const assignment = activeAssignments.find((a) => a.roomId === roomId);
    const latest = getLatestByRoomId(roomId);
    setForm(
      buildFormState({
        room,
        tenantId: assignment?.tenantId,
        settings,
        latest,
        otherChargeMasters: otherCharges,
        language,
      }),
    );
  }

  function updateCharge(key: string, field: "name" | "amount", value: string) {
    setForm({
      ...form,
      otherCharges: form.otherCharges.map((c) =>
        c.key === key ? { ...c, [field]: value } : c,
      ),
    });
  }

  function removeCharge(key: string) {
    setForm({
      ...form,
      otherCharges: form.otherCharges.filter((c) => c.key !== key),
    });
  }

  const electricityPreview = calculateMeterReading(
    Number(form.electricityPreviousMeter) || 0,
    Number(form.electricityCurrentMeter) || 0,
    Number(form.electricityRate) || 0,
  );
  const waterPreview = calculateMeterReading(
    Number(form.waterPreviousMeter) || 0,
    Number(form.waterCurrentMeter) || 0,
    Number(form.waterRate) || 0,
  );
  const chargesPreview = form.otherCharges.map((c) => ({
    amount: Number(c.amount) || 0,
  }));
  const totals = calculateBillingTotals({
    electricityAmount: electricityPreview.amount,
    waterAmount: waterPreview.amount,
    rentAmount: Number(form.rentAmount) || 0,
    otherCharges: chargesPreview,
  });

  async function handleSubmit() {
    if (isSubmitting) return;

    const input: CreateBillingInput = {
      roomId: form.roomId,
      tenantId: form.tenantId || undefined,
      billingMonth: form.billingMonth,
      electricityPreviousMeter: Number(form.electricityPreviousMeter) || 0,
      electricityCurrentMeter: Number(form.electricityCurrentMeter) || 0,
      electricityRate: Number(form.electricityRate) || 0,
      waterPreviousMeter: Number(form.waterPreviousMeter) || 0,
      waterCurrentMeter: Number(form.waterCurrentMeter) || 0,
      waterRate: Number(form.waterRate) || 0,
      rentAmount: Number(form.rentAmount) || 0,
      otherCharges: form.otherCharges
        .filter((c) => c.name.trim() !== "")
        .map((c) => ({
          masterId: c.masterId,
          name: c.name.trim(),
          amount: Number(c.amount) || 0,
        })),
      dueDate: form.dueDate || undefined,
      status: form.status,
    };
    const validationErrors = validateBilling(input);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(input);
      toast.success(
        record ? t("billing.updatedToast") : t("billing.createdToast"),
      );
      onOpenChange(false);
    } catch (error) {
      if (error instanceof BillingAlreadyExistsError) {
        const roomNumber =
          rooms.find((room) => room.id === form.roomId)?.roomNumber ?? form.roomId;
        toast.error(
          t("billing.duplicateBillError", {
            roomNumber,
            billingMonth: formatBillingMonth(form.billingMonth, language),
          }),
        );
      } else {
        toast.error(t("common.actionFailed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {record ? t("billing.editBilling") : t("billing.createBilling")}
          </DialogTitle>
          <DialogDescription>{t("billing.formDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="billing-room">{t("common.room")}</Label>
              <Select
                value={form.roomId}
                onValueChange={handleRoomChange}
                disabled={Boolean(record)}>
                <SelectTrigger id="billing-room">
                  <SelectValue placeholder={t("assignment.selectRoom")} />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.roomNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roomId && (
                <p className="text-xs text-destructive">{t(errors.roomId)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-tenant">{t("common.tenant")}</Label>
              <Select
                value={form.tenantId || "none"}
                onValueChange={(value) =>
                  setForm({ ...form, tenantId: value === "none" ? "" : value })
                }>
                <SelectTrigger id="billing-tenant">
                  <SelectValue placeholder={t("common.noTenant")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.noTenant")}</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-month">{t("billing.billingMonth")}</Label>
              <DatePicker
                id="billing-month"
                value={form.billingMonth}
                disabled={Boolean(record)}
                mode="month"
                onChange={(billingMonth) => {
                  setForm({ ...form, billingMonth });
                  clearError("billingMonth");
                }}
              />
              {errors.billingMonth && (
                <p className="text-xs text-destructive">
                  {t(errors.billingMonth)}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="mb-2 text-sm font-semibold">
              {t("billing.electricitySection")}
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="elec-prev">{t("billing.previousMeter")}</Label>
                <Input
                  id="elec-prev"
                  type="text"
                  inputMode="decimal"
                  value={form.electricityPreviousMeter}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      electricityPreviousMeter: e.target.value,
                    });
                    clearError("electricityCurrentMeter");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="elec-cur">{t("billing.currentMeter")}</Label>
                <Input
                  id="elec-cur"
                  type="text"
                  inputMode="decimal"
                  value={form.electricityCurrentMeter}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      electricityCurrentMeter: e.target.value,
                    });
                    clearError("electricityCurrentMeter");
                  }}
                />
                {errors.electricityCurrentMeter && (
                  <p className="text-xs text-destructive">
                    {t(errors.electricityCurrentMeter)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="elec-rate">{t("billing.rate")}</Label>
                <Input
                  id="elec-rate"
                  type="text"
                  inputMode="decimal"
                  value={form.electricityRate}
                  onChange={(e) =>
                    setForm({ ...form, electricityRate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("billing.usageAmount")}</Label>
                <p className="flex h-9 items-center text-sm text-muted-foreground">
                  {t("billing.usageAmountPreview", {
                    usage: electricityPreview.usage,
                    amount: formatCurrency(electricityPreview.amount, language),
                  })}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">
              {t("billing.waterSection")}
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="water-prev">{t("billing.previousMeter")}</Label>
                <Input
                  id="water-prev"
                  type="text"
                  inputMode="decimal"
                  value={form.waterPreviousMeter}
                  onChange={(e) => {
                    setForm({ ...form, waterPreviousMeter: e.target.value });
                    clearError("waterCurrentMeter");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="water-cur">{t("billing.currentMeter")}</Label>
                <Input
                  id="water-cur"
                  type="text"
                  inputMode="decimal"
                  value={form.waterCurrentMeter}
                  onChange={(e) => {
                    setForm({ ...form, waterCurrentMeter: e.target.value });
                    clearError("waterCurrentMeter");
                  }}
                />
                {errors.waterCurrentMeter && (
                  <p className="text-xs text-destructive">
                    {t(errors.waterCurrentMeter)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="water-rate">{t("billing.rate")}</Label>
                <Input
                  id="water-rate"
                  type="text"
                  inputMode="decimal"
                  value={form.waterRate}
                  onChange={(e) =>
                    setForm({ ...form, waterRate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("billing.usageAmount")}</Label>
                <p className="flex h-9 items-center text-sm text-muted-foreground">
                  {t("billing.usageAmountPreview", {
                    usage: waterPreview.usage,
                    amount: formatCurrency(waterPreview.amount, language),
                  })}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rent">{t("billing.rentAmount")}</Label>
              <Input
                id="rent"
                type="text"
                inputMode="decimal"
                value={form.rentAmount}
                onChange={(e) => {
                  setForm({ ...form, rentAmount: e.target.value });
                  clearError("rentAmount");
                }}
              />
              {errors.rentAmount && (
                <p className="text-xs text-destructive">
                  {t(errors.rentAmount)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due-date">{t("common.dueDate")}</Label>
              <DatePicker
                id="due-date"
                value={form.dueDate}
                onChange={(dueDate) => setForm({ ...form, dueDate })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">{t("common.status")}</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm({ ...form, status: value as "draft" | "issued" })
                }>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("status.draft")}</SelectItem>
                  <SelectItem value="issued">{t("status.issued")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">
              {t("billing.otherCharges")}
            </h4>
            {availableMasters.length > 0 ? (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedMasterId}
                  onValueChange={setSelectedMasterId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={t("billing.otherChargesSelectPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMasters.map((master) => (
                      <SelectItem key={master.id} value={master.id}>
                        {masterDisplayName(master)} ·{" "}
                        {formatCurrency(master.defaultAmount, language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addMasterCharge}
                  disabled={!selectedMasterId}>
                  <Plus className="h-4 w-4" /> {t("billing.otherChargesAdd")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("billing.otherChargesNoneAvailable")}
              </p>
            )}

            {form.otherCharges.map((charge) => (
              <div key={charge.key} className="flex items-center gap-2">
                {charge.masterId ? (
                  <p className="flex-1 text-sm">{charge.name}</p>
                ) : (
                  <Input
                    placeholder={t("billing.chargeNamePlaceholder")}
                    value={charge.name}
                    onChange={(e) =>
                      updateCharge(charge.key, "name", e.target.value)
                    }
                  />
                )}
                <Input
                  type="text"
                  inputMode="decimal"
                  className="w-32"
                  placeholder={t("billing.chargeAmountPlaceholder")}
                  value={charge.amount}
                  onChange={(e) =>
                    updateCharge(charge.key, "amount", e.target.value)
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCharge(charge.key)}>
                  <X className="h-4 w-4" />
                  <span className="sr-only">
                    {t("billing.otherChargesRemove")}
                  </span>
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomCharge}>
              <Plus className="h-4 w-4" /> {t("billing.addCharge")}
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between rounded-md bg-muted p-4">
            <div className="text-sm">
              <p className="text-muted-foreground">
                {t("billing.subtotalLine", {
                  amount: formatCurrency(totals.subtotal, language),
                })}
              </p>
              <p className="text-lg font-semibold">
                {t("billing.totalLine", {
                  amount: formatCurrency(totals.total, language),
                })}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {record ? t("common.saveChanges") : t("billing.createBilling")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
