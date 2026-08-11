import { useState } from "react";
import { toast } from "sonner";
import { Check, Sun, Moon, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/PageHeader";
import { PageSpinner } from "@/components/common/PageSpinner";
import { ThemeAccentSwatches } from "@/components/common/ThemeAccentSwatches";
import { OtherChargeSection } from "@/features/settings/OtherChargeSection";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/i18n";
import {
  useTheme,
  ACCENT_THEMES,
  APPEARANCES,
  accentThemeTranslationKey,
  type Appearance,
} from "@/theme";
import { cn } from "@/lib/utils";
import type { PropertySettings } from "@/types/settings";

const APPEARANCE_ICONS: Record<Appearance, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

function toFormState(settings: PropertySettings) {
  return {
    propertyName: settings.propertyName,
    propertyAddress: settings.propertyAddress,
    phone: settings.phone,
    defaultElectricityRate: String(settings.defaultElectricityRate),
    defaultWaterRate: String(settings.defaultWaterRate),
    defaultInvoiceNote: settings.defaultInvoiceNote,
  };
}

export function SettingsPage() {
  const { settings, isLoading, updateSettings } = useSettings();

  if (isLoading || !settings) return <PageSpinner />;

  return <SettingsForm settings={settings} updateSettings={updateSettings} />;
}

interface SettingsFormProps {
  settings: PropertySettings;
  updateSettings: (input: Partial<PropertySettings>) => Promise<PropertySettings>;
}

function SettingsForm({ settings, updateSettings }: SettingsFormProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => toFormState(settings));
  const { appearance, accentTheme, setAppearance, setAccentTheme } = useTheme();

  function handleSave() {
    updateSettings({
      propertyName: form.propertyName.trim(),
      propertyAddress: form.propertyAddress.trim(),
      phone: form.phone.trim(),
      defaultElectricityRate: Number(form.defaultElectricityRate) || 0,
      defaultWaterRate: Number(form.defaultWaterRate) || 0,
      defaultInvoiceNote: form.defaultInvoiceNote.trim(),
    });
    toast.success(t("settings.savedToast"));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("settings.propertyInformation")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="propertyName">{t("settings.propertyName")}</Label>
            <Input
              id="propertyName"
              value={form.propertyName}
              onChange={(e) =>
                setForm({ ...form, propertyName: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="propertyAddress">
              {t("settings.propertyAddress")}
            </Label>
            <Textarea
              id="propertyAddress"
              value={form.propertyAddress}
              onChange={(e) =>
                setForm({ ...form, propertyAddress: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("settings.phone")}</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("settings.defaultBillingRates")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="defaultElectricityRate">
                {t("settings.defaultElectricityRate")}
              </Label>
              <Input
                id="defaultElectricityRate"
                type="number"
                min={0}
                value={form.defaultElectricityRate}
                onChange={(e) =>
                  setForm({ ...form, defaultElectricityRate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultWaterRate">
                {t("settings.defaultWaterRate")}
              </Label>
              <Input
                id="defaultWaterRate"
                type="number"
                min={0}
                value={form.defaultWaterRate}
                onChange={(e) =>
                  setForm({ ...form, defaultWaterRate: e.target.value })
                }
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="defaultInvoiceNote">
              {t("settings.defaultInvoiceNote")}
            </Label>
            <Textarea
              id="defaultInvoiceNote"
              value={form.defaultInvoiceNote}
              onChange={(e) =>
                setForm({ ...form, defaultInvoiceNote: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      <OtherChargeSection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.theme")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("settings.appearance")}</p>
            <div className="grid grid-cols-3 gap-2">
              {APPEARANCES.map((option) => {
                const Icon = APPEARANCE_ICONS[option];
                const isActive = appearance === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAppearance(option)}
                    aria-pressed={isActive}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-colors",
                      isActive
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border hover:bg-accent/50",
                    )}>
                    {isActive && (
                      <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />
                    )}
                    <Icon className="h-5 w-5" />
                    {t(`theme.${option}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("settings.accentTheme")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ACCENT_THEMES.map((themeOption) => {
                const isActive = accentTheme === themeOption;
                return (
                  <button
                    key={themeOption}
                    type="button"
                    onClick={() => setAccentTheme(themeOption)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                      isActive
                        ? "border-primary bg-accent/60"
                        : "border-border hover:bg-accent/30",
                    )}>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {t(accentThemeTranslationKey(themeOption))}
                      </p>
                      <ThemeAccentSwatches accentTheme={themeOption} />
                    </div>
                    {isActive && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave}>{t("settings.save")}</Button>
    </div>
  );
}
