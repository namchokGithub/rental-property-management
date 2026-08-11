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
import { validateTenant, type ValidationErrors } from "@/lib/validation";
import type { Tenant, CreateTenantInput, TenantStatus } from "@/types/tenant";

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: Tenant;
  onSubmit: (input: CreateTenantInput) => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  identificationNumber: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: TenantStatus;
  notes: string;
}

function toFormState(tenant: Tenant | undefined): FormState {
  return {
    name: tenant?.name ?? "",
    phone: tenant?.phone ?? "",
    email: tenant?.email ?? "",
    identificationNumber: tenant?.identificationNumber ?? "",
    address: tenant?.address ?? "",
    emergencyContactName: tenant?.emergencyContactName ?? "",
    emergencyContactPhone: tenant?.emergencyContactPhone ?? "",
    status: tenant?.status ?? "active",
    notes: tenant?.notes ?? "",
  };
}

export function TenantFormDialog({ open, onOpenChange, tenant, onSubmit }: TenantFormDialogProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>(() => toFormState(tenant));
  const [errors, setErrors] = useState<ValidationErrors>({});

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(toFormState(tenant));
      setErrors({});
    }
    onOpenChange(next);
  }

  function handleSubmit() {
    const input: CreateTenantInput = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      identificationNumber: form.identificationNumber.trim() || undefined,
      address: form.address.trim() || undefined,
      emergencyContactName: form.emergencyContactName.trim() || undefined,
      emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    };
    const validationErrors = validateTenant(input);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(input);
    toast.success(tenant ? t("tenant.updatedToast") : t("tenant.createdToast"));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tenant ? t("tenant.editTenant") : t("tenant.addTenant")}</DialogTitle>
          <DialogDescription>
            {tenant ? t("tenant.editTenantDescription") : t("tenant.addTenantDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">{t("tenant.name")}</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {errors.name && <p className="text-xs text-destructive">{t(errors.name)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("common.phone")}</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="identificationNumber">{t("tenant.identificationNumber")}</Label>
            <Input
              id="identificationNumber"
              value={form.identificationNumber}
              onChange={(e) => setForm({ ...form, identificationNumber: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">{t("common.status")}</Label>
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as TenantStatus })}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("status.active")}</SelectItem>
                <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">{t("common.address")}</Label>
            <Textarea id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactName">{t("tenant.emergencyContactName")}</Label>
            <Input
              id="emergencyContactName"
              value={form.emergencyContactName}
              onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactPhone">{t("tenant.emergencyContactPhone")}</Label>
            <Input
              id="emergencyContactPhone"
              value={form.emergencyContactPhone}
              onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">{t("common.notes")}</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>{tenant ? t("common.saveChanges") : t("tenant.addTenant")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
