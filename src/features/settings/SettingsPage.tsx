import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/PageHeader";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/i18n";
import type { PropertySettings } from "@/types/settings";

function toFormState(settings: PropertySettings) {
  return {
    propertyName: settings.propertyName,
    propertyAddress: settings.propertyAddress,
    phone: settings.phone,
    defaultElectricityRate: String(settings.defaultElectricityRate),
    defaultWaterRate: String(settings.defaultWaterRate),
    defaultGarbageFee: String(settings.defaultGarbageFee),
    defaultElectricityMeterMaintenanceFee: String(settings.defaultElectricityMeterMaintenanceFee),
    defaultWaterMeterMaintenanceFee: String(settings.defaultWaterMeterMaintenanceFee),
    defaultInvoiceNote: settings.defaultInvoiceNote,
  };
}

export function SettingsPage() {
  const { t } = useLanguage();
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState(() => toFormState(settings));

  function handleSave() {
    updateSettings({
      propertyName: form.propertyName.trim(),
      propertyAddress: form.propertyAddress.trim(),
      phone: form.phone.trim(),
      defaultElectricityRate: Number(form.defaultElectricityRate) || 0,
      defaultWaterRate: Number(form.defaultWaterRate) || 0,
      defaultGarbageFee: Number(form.defaultGarbageFee) || 0,
      defaultElectricityMeterMaintenanceFee: Number(form.defaultElectricityMeterMaintenanceFee) || 0,
      defaultWaterMeterMaintenanceFee: Number(form.defaultWaterMeterMaintenanceFee) || 0,
      defaultInvoiceNote: form.defaultInvoiceNote.trim(),
    });
    toast.success(t("settings.savedToast"));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.propertyInformation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="propertyName">{t("settings.propertyName")}</Label>
            <Input
              id="propertyName"
              value={form.propertyName}
              onChange={(e) => setForm({ ...form, propertyName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="propertyAddress">{t("settings.propertyAddress")}</Label>
            <Textarea
              id="propertyAddress"
              value={form.propertyAddress}
              onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("settings.phone")}</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.defaultBillingRates")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="defaultElectricityRate">{t("settings.defaultElectricityRate")}</Label>
              <Input
                id="defaultElectricityRate"
                type="number"
                min={0}
                value={form.defaultElectricityRate}
                onChange={(e) => setForm({ ...form, defaultElectricityRate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultWaterRate">{t("settings.defaultWaterRate")}</Label>
              <Input
                id="defaultWaterRate"
                type="number"
                min={0}
                value={form.defaultWaterRate}
                onChange={(e) => setForm({ ...form, defaultWaterRate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultGarbageFee">{t("settings.defaultGarbageFee")}</Label>
              <Input
                id="defaultGarbageFee"
                type="number"
                min={0}
                value={form.defaultGarbageFee}
                onChange={(e) => setForm({ ...form, defaultGarbageFee: e.target.value })}
              />
            </div>
            <div />
            <div className="space-y-1.5">
              <Label htmlFor="defaultElectricityMeterMaintenanceFee">{t("settings.electricityMaintenanceFee")}</Label>
              <Input
                id="defaultElectricityMeterMaintenanceFee"
                type="number"
                min={0}
                value={form.defaultElectricityMeterMaintenanceFee}
                onChange={(e) => setForm({ ...form, defaultElectricityMeterMaintenanceFee: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultWaterMeterMaintenanceFee">{t("settings.waterMaintenanceFee")}</Label>
              <Input
                id="defaultWaterMeterMaintenanceFee"
                type="number"
                min={0}
                value={form.defaultWaterMeterMaintenanceFee}
                onChange={(e) => setForm({ ...form, defaultWaterMeterMaintenanceFee: e.target.value })}
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="defaultInvoiceNote">{t("settings.defaultInvoiceNote")}</Label>
            <Textarea
              id="defaultInvoiceNote"
              value={form.defaultInvoiceNote}
              onChange={(e) => setForm({ ...form, defaultInvoiceNote: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave}>{t("settings.save")}</Button>
    </div>
  );
}
