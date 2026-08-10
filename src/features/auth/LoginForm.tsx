import { useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/auth";
import { DEMO_CREDENTIALS_HINT } from "@/auth/auth.service";
import { useLanguage } from "@/i18n";
import { validateLogin, type ValidationErrors } from "@/lib/validation";

export function LoginForm() {
  const { t } = useLanguage();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const fieldErrors = validateLogin({ email, password });
    setErrors(fieldErrors);
    setFormError(undefined);
    if (Object.keys(fieldErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // Never reveal whether the email or password specifically was wrong.
      setFormError(t("auth.error.invalidCredentials"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="login-email">{t("auth.email")}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
          disabled={isSubmitting}
        />
        {errors.email && <p className="text-sm text-destructive">{t(errors.email)}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-password">{t("auth.password")}</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            disabled={isSubmitting}
            className="pr-10"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{showPassword ? t("auth.hidePassword") : t("auth.showPassword")}</TooltipContent>
          </Tooltip>
        </div>
        {errors.password && <p className="text-sm text-destructive">{t(errors.password)}</p>}
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? t("auth.login.loading") : t("auth.login.submit")}
      </Button>

      {import.meta.env.DEV && (
        <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">{t("auth.demoAccountLabel")}</p>
          <p>{DEMO_CREDENTIALS_HINT.email}</p>
          <p>{DEMO_CREDENTIALS_HINT.password}</p>
        </div>
      )}
    </form>
  );
}
