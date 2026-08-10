export type Appearance = "light" | "dark" | "system";

export type AccentTheme = "sky-purple" | "ocean" | "emerald" | "rose";

/** The actually-rendered mode once "system" is resolved against the OS preference. */
export type ResolvedAppearance = "light" | "dark";

export const APPEARANCES: Appearance[] = ["light", "dark", "system"];

export const ACCENT_THEMES: AccentTheme[] = ["sky-purple", "ocean", "emerald", "rose"];

export const DEFAULT_APPEARANCE: Appearance = "system";

export const DEFAULT_ACCENT_THEME: AccentTheme = "sky-purple";

/** e.g. "sky-purple" -> "theme.skyPurple", matching the `theme.*` i18n keys. */
export function accentThemeTranslationKey(accentTheme: AccentTheme): string {
  const camelCased = accentTheme.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return `theme.${camelCased}`;
}
