import { cn } from "@/lib/utils";
import type { AccentTheme } from "@/theme";

const SWATCH_CLASSES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

interface ThemeAccentSwatchesProps {
  accentTheme: AccentTheme;
  className?: string;
}

/**
 * Renders the 5 chart-color dots for a given accent theme, regardless of which
 * theme is currently active — the `data-theme` attribute on this wrapper scopes
 * the CSS custom properties locally, overriding whatever <html> currently has.
 */
export function ThemeAccentSwatches({ accentTheme, className }: ThemeAccentSwatchesProps) {
  return (
    <div data-theme={accentTheme} className={cn("flex items-center gap-1.5", className)}>
      {SWATCH_CLASSES.map((cls) => (
        <span key={cls} className={cn("h-3.5 w-3.5 rounded-full", cls)} />
      ))}
    </div>
  );
}
