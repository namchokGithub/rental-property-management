import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitch } from "@/components/common/LanguageSwitch";
import { LoginForm } from "@/features/auth/LoginForm";
import { useLanguage } from "@/i18n";

export function LoginPage() {
  const { t } = useLanguage();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitch />
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Building2 className="h-6 w-6" />
          {t("auth.brandTitle")}
        </div>
        <p className="text-sm text-muted-foreground">{t("auth.brandDescription")}</p>
      </div>

      <Card className="w-full max-w-[420px]">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("auth.login.title")}</CardTitle>
          <CardDescription>{t("auth.login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
