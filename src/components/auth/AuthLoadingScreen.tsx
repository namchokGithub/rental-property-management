import { LoaderCircle } from "lucide-react";
import { useLanguage } from "@/i18n";

export function AuthLoadingScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{t("auth.loadingSession")}</p>
    </div>
  );
}
