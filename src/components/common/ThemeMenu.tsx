import { Sun, Moon, Monitor, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/i18n";
import { useTheme, ACCENT_THEMES, APPEARANCES, accentThemeTranslationKey, type Appearance } from "@/theme";
import { cn } from "@/lib/utils";

const APPEARANCE_ICONS: Record<Appearance, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export function ThemeMenu() {
  const { t } = useLanguage();
  const { appearance, accentTheme, resolvedAppearance, setAppearance, setAccentTheme } = useTheme();
  const TriggerIcon = resolvedAppearance === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <TriggerIcon className="h-4 w-4" />
          <span className="sr-only">{t("settings.theme")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("settings.appearance")}</DropdownMenuLabel>
        {APPEARANCES.map((option) => {
          const Icon = APPEARANCE_ICONS[option];
          return (
            <DropdownMenuItem key={option} onClick={() => setAppearance(option)}>
              <Icon className="h-4 w-4" />
              {t(`theme.${option}`)}
              {appearance === option && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          {t("settings.accentTheme")}
        </DropdownMenuLabel>
        <div className="flex items-center gap-2 px-2 py-1.5">
          {ACCENT_THEMES.map((themeOption) => (
            <button
              key={themeOption}
              type="button"
              data-theme={themeOption}
              onClick={() => setAccentTheme(themeOption)}
              aria-label={t(accentThemeTranslationKey(themeOption))}
              aria-pressed={accentTheme === themeOption}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full bg-primary ring-2 ring-offset-2 ring-offset-popover transition-shadow",
                accentTheme === themeOption ? "ring-ring" : "ring-transparent"
              )}
            >
              {accentTheme === themeOption && <Check className="h-3 w-3 text-primary-foreground" />}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
