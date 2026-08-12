import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LanguageSwitch } from "@/components/common/LanguageSwitch";
import { ThemeMenu } from "@/components/common/ThemeMenu";
import { LoginForm } from "@/features/auth/LoginForm";
import { useLanguage } from "@/i18n";
import renthouseLogo from "@/assets/branding/renthouse.png";

export function LoginPage() {
  const { t } = useLanguage();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageSwitch />
        <ThemeMenu />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <img
          src={renthouseLogo}
          alt="Rent House"
          className="h-28 w-auto rounded-xl shadow-sm"
        />
        <div className="text-xl font-semibold tracking-tight">
          {t("auth.brandTitle")}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("auth.brandDescription")}
        </p>
      </div>

      <Card className="w-full max-w-[420px] shadow-xl">
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
