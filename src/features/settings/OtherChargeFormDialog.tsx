import { useEffect, useState } from "react";
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
import { useLanguage } from "@/i18n";
import { validateOtherCharge, type ValidationErrors } from "@/lib/validation";
import type { OtherChargeMaster, CreateOtherChargeInput } from "@/types/otherCharge";

interface OtherChargeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge?: OtherChargeMaster;
  onSubmit: (input: CreateOtherChargeInput) => void;
}

interface FormState {
  nameTh: string;
  nameEn: string;
  defaultAmount: string;
}

function buildFormState(charge?: OtherChargeMaster): FormState {
  return {
    nameTh: charge?.nameTh ?? "",
    nameEn: charge?.nameEn ?? "",
    defaultAmount: charge ? String(charge.defaultAmount) : "0",
  };
}

export function OtherChargeFormDialog({ open, onOpenChange, charge, onSubmit }: OtherChargeFormDialogProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>(() => buildFormState(charge));
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (open) {
      setForm(buildFormState(charge));
      setErrors({});
    }
  }, [open, charge]);

  function handleSubmit() {
    const input: CreateOtherChargeInput = {
      nameTh: form.nameTh.trim(),
      nameEn: form.nameEn.trim() || undefined,
      defaultAmount: Number(form.defaultAmount) || 0,
      isActive: charge?.isActive ?? true,
    };
    const validationErrors = validateOtherCharge(input);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(input);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{charge ? t("settings.otherChargesEdit") : t("settings.otherChargesAdd")}</DialogTitle>
          <DialogDescription>{t("settings.otherChargesTitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="charge-name-th">{t("settings.otherChargesNameTh")}</Label>
            <Input
              id="charge-name-th"
              placeholder={t("settings.otherChargesNamePlaceholder")}
              value={form.nameTh}
              onChange={(e) => setForm({ ...form, nameTh: e.target.value })}
            />
            {errors.nameTh && <p className="text-xs text-destructive">{t(errors.nameTh)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="charge-name-en">{t("settings.otherChargesNameEn")}</Label>
            <Input
              id="charge-name-en"
              placeholder={t("settings.otherChargesNameEnPlaceholder")}
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="charge-amount">{t("settings.otherChargesDefaultAmount")}</Label>
            <Input
              id="charge-amount"
              type="number"
              min={0}
              placeholder={t("settings.otherChargesAmountPlaceholder")}
              value={form.defaultAmount}
              onChange={(e) => setForm({ ...form, defaultAmount: e.target.value })}
            />
            {errors.defaultAmount && <p className="text-xs text-destructive">{t(errors.defaultAmount)}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>{charge ? t("common.saveChanges") : t("settings.otherChargesAdd")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
