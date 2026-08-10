import {
  ACCENT_THEMES,
  APPEARANCES,
  DEFAULT_ACCENT_THEME,
  DEFAULT_APPEARANCE,
  type AccentTheme,
  type Appearance,
} from "@/theme/theme.types";

// Non-domain UI preference keys — deliberately unprefixed, same convention as
// `app.language` (see src/i18n/index.ts): a raw localStorage read/write, not
// routed through the `rental.`-prefixed repository storage layer.
const APPEARANCE_KEY = "app.appearance";
const ACCENT_THEME_KEY = "app.accentTheme";

function isAppearance(value: string | null): value is Appearance {
  return APPEARANCES.includes(value as Appearance);
}

function isAccentTheme(value: string | null): value is AccentTheme {
  return ACCENT_THEMES.includes(value as AccentTheme);
}

export function readAppearance(): Appearance {
  if (typeof localStorage === "undefined") return DEFAULT_APPEARANCE;
  const stored = localStorage.getItem(APPEARANCE_KEY);
  return isAppearance(stored) ? stored : DEFAULT_APPEARANCE;
}

export function writeAppearance(appearance: Appearance): void {
  localStorage.setItem(APPEARANCE_KEY, appearance);
}

export function readAccentTheme(): AccentTheme {
  if (typeof localStorage === "undefined") return DEFAULT_ACCENT_THEME;
  const stored = localStorage.getItem(ACCENT_THEME_KEY);
  return isAccentTheme(stored) ? stored : DEFAULT_ACCENT_THEME;
}

export function writeAccentTheme(accentTheme: AccentTheme): void {
  localStorage.setItem(ACCENT_THEME_KEY, accentTheme);
}
