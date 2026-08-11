# Project Overview

Frontend-only web application for managing rental rooms/apartments/dormitory rooms. A property owner/admin manages rooms, tenants, tenant-room assignments, monthly utility and rent billing, invoice generation/printing, and property settings from a responsive admin dashboard. There is no backend — all data lives in `localStorage`, accessed exclusively through a repository layer designed to be swapped for Firebase or a REST API later without touching feature/UI code.

# Current Tech Stack

- Vite 8, React 19, TypeScript ~6.0 (strict mode on)
- Tailwind CSS v4 via `@tailwindcss/vite` (CSS-first config, no `tailwind.config.js` — theme tokens live in `src/index.css`)
- Radix UI primitives via the unified `radix-ui` npm package, hand-authored into `src/components/ui/*` in the shadcn/ui convention (see "shadcn/ui note" below)
- `class-variance-authority`, `clsx`, `tailwind-merge` for variant/class composition
- `react-router` (v8) for navigation
- `lucide-react` for icons
- `sonner` for toast notifications
- `oxlint` for linting (Vite's current default; runs via `pnpm lint`)
- Custom lightweight i18n (`src/i18n/*`) — no i18n library; see Localization Architecture below
- Package manager: pnpm

**shadcn/ui note:** the `shadcn` CLI (`pnpm dlx shadcn@latest add ...`) is unreliable in this environment — in testing it resolved the `@/` import alias incorrectly and wrote generated files to a literal `./@/components/ui/...` directory at the repo root instead of `src/components/ui/`, so nothing ended up on the real import path. All `src/components/ui/*` primitives and `src/lib/utils.ts` in this repo were hand-authored directly against the `radix-ui` package instead of via the CLI. If you use the CLI again, verify with `ls src/components/ui/` immediately after — do not trust its "Created N files" / "Skipped N files (identical)" output.

# Architecture

## Application navigation

Real routes via `react-router`, defined in `src/app/router.tsx`:

```
/                 -> redirect to /dashboard
/dashboard, /rooms, /tenants, /billing, /invoices, /settings   -> rendered inside AppLayout (sidebar + header)
/invoices/:id     -> standalone route, NOT wrapped in AppLayout
```

`/invoices/:id` deliberately has no shared layout — it's both the invoice preview and the print target. Because the sidebar/header simply never mount on that route, there's nothing to hide with print CSS beyond the small on-screen toolbar (`.no-print`).

## Feature organization

One folder per feature under `src/features/<feature>/`: the page component plus its table/form-dialog/detail-sheet subcomponents. Shared UI lives in `src/components/{ui,layout,common}`.

## State strategy

No global state library and no app-wide Context. Each domain has a thin custom hook (`src/hooks/use*.ts`) wrapping its repository: `useRooms`, `useTenants`, `useAssignments`, `useBillingRecords`, `useSettings`. Each hook holds the collection in `useState`, seeded from a synchronous repository read, and calls `refresh()` (re-read + `setState`) after every mutation. UI-only state (dialog open/closed, selected row, form fields) is local `useState` in the component that owns it.

## Repository architecture

```
src/data/
  storage/storage.ts        # generic localStorage read/write, JSON (de)serialized, key-prefixed with "rental."
  repositories/
    roomRepository.ts
    tenantRepository.ts
    assignmentRepository.ts
    billingRepository.ts
    settingsRepository.ts
  seed/seedData.ts
```

Components and hooks never call `localStorage` directly — only repository modules import `storage.ts`. Each repository exposes `getAll/getById/create/update/delete` (plus domain-specific queries, e.g. `assignmentRepository.getActiveByRoomId`). This boundary is the intended Firebase/REST swap point: reimplement a repository's function bodies as `async` (Firestore/REST calls) behind the same signatures, then update the hooks that call them to `await` — UI/feature code does not need to change.

## localStorage usage

All domain keys are prefixed `rental.` (see Storage Keys below). IDs are generated with `crypto.randomUUID()`; `createdAt`/`updatedAt` are ISO timestamp strings stamped by the repository, not the caller. The one non-domain key is `app.language` (see Localization Architecture below), which intentionally does **not** use the `rental.` prefix — it's a UI preference, not property data.

# Localization Architecture

Custom, lightweight i18n — no `react-i18next` or similar library. Two languages ship today: Thai (`th`, default) and English (`en`).

```
src/i18n/
  types.ts               # Language union, the full Translations interface (nested per feature), TranslationParams
  index.ts                # LanguageContext, LanguageProvider, useLanguage() hook, t() lookup+interpolation, DICTIONARIES registry
  translations/
    en.ts                  # English dictionary, typed `: Translations` — TS errors if a key is missing/mistyped
    th.ts                  # Thai dictionary, same shape
```

**Language Context.** `LanguageProvider` (in `src/i18n/index.ts`) wraps the whole app in `src/app/App.tsx`, *outside* `RouterProvider` — this matters because `/invoices/:id` is a standalone route with no `AppLayout`, but it still needs language context. `useLanguage()` returns `{ language, setLanguage, t }`. Every component that renders user-facing text calls this hook directly; there is no prop-drilling of translations.

**Translation keys** are nested per feature/domain, e.g. `common.save`, `room.roomNumber`, `billing.total`, `invoice.remark`, `validation.room.roomNumberRequired`. `Translations` in `types.ts` is the single source of truth for the shape — both `en.ts` and `th.ts` are typed `: Translations`, so TypeScript itself guarantees every key exists in both languages (no runtime drift possible).

**`t(key, params?)`** looks up the dotted key in the current language's dictionary. If the key doesn't resolve, it returns the raw key string (per spec — never throws, never silently blanks). For dynamic content (e.g. "Delete room 101?"), translation strings contain `{{paramName}}` placeholders and `t()` does simple string substitution: `t("room.deleteConfirmTitle", { roomNumber: "101" })` → `"Delete room 101?"` / `"ต้องการลบห้อง 101 หรือไม่?"`. This is the *only* mechanism for dynamic text — never build strings with `language === "th" ? ... : ...` inline in a component.

**Locale-aware formatters** live alongside the existing calculation helpers, not inside `src/i18n/`, since they're pure formatting utilities already established in `src/lib/`:
- `formatCurrency(amount, language)` (`src/lib/currency.ts`) — `th` → `฿1,200.00` (`Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" })`); `en` → `THB 1,200.00` (`Intl.NumberFormat("en-US", { ..., currencyDisplay: "code" })`).
- `formatDate(iso, language)` and `formatBillingMonth(billingMonth, language)` (`src/lib/date.ts`) — `th` → `th-TH` locale (renders the Buddhist-era year automatically, e.g. `10 สิงหาคม 2569`); `en` → `en-US` locale (e.g. `August 10, 2026`).

**Status labels** (`StatusBadge`) and the invoice document's status line both resolve through the same `status.*` keys (`status.available`, `status.issued`, etc.) — there is exactly one source of truth for status labels, not the two independent hardcoded maps (English in `StatusBadge`, Thai in `InvoicePrintView`) that existed before this pass.

**Validation messages** (`src/lib/validation.ts`) return translation *keys* (e.g. `"validation.room.roomNumberRequired"`), never literal strings — the validators stay language-agnostic, and the component displaying the error calls `t(errors.fieldName)`. This is what keeps localization "completely isolated from business logic" per the requirement: `src/lib/validation.ts` has zero imports from `src/i18n/`.

**Storage key:** `app.language`, holding the raw string `"th"` or `"en"`. Read once on `LanguageProvider` mount (`localStorage.getItem`), written on every `setLanguage()` call. Missing or invalid values fall back to the default (`"th"`).

**Language switch UI:** a shared `LanguageSwitch` component (`src/components/common/LanguageSwitch.tsx`) — two `Button`s ("ไทย" / "EN"), the active one rendered with `variant="default"` and the inactive with `variant="ghost"`. Switching calls `setLanguage()` — no page reload, every mounted component re-renders instantly because they all read `language`/`t` from the same context. Rendered in both `AppHeader` (authenticated app) and `LoginPage` (pre-auth) — the same component, so there is no duplicated language state.

**How to add a new language (e.g. `ja`):**
1. Add `"ja"` to the `Language` union in `src/i18n/types.ts`.
2. Create `src/i18n/translations/ja.ts` exporting a default object typed `: Translations` — TypeScript will list every missing key as a compile error, so it's impossible to ship an incomplete dictionary.
3. Register it in the `DICTIONARIES` map in `src/i18n/index.ts` (`{ en, th, ja }`).
4. Add a third button (or switch to a `Select`/`DropdownMenu`) to `LanguageSwitch`.

No component outside those four spots needs to change — every feature file only ever calls `t("some.key")`, never references a language literal directly (aside from the switch buttons themselves).

# Search

Every list page (Rooms, Tenants, Billing, Invoices) has a client-side search box between the `PageHeader` and the data table, filtering the already-loaded array in `useMemo` — there is no search API and no state-management library involved.

- `src/components/common/SearchInput.tsx` — the shared input (shadcn `Input` + `lucide-react` `Search` icon positioned absolutely inside), used identically on all four pages so the search UI is visually consistent.
- `src/lib/search.ts` — `matchesSearch(query, ...fields)`, a small case-insensitive substring matcher shared by every page's filter `useMemo`. An empty query always matches (so the unfiltered list shows by default).
- Each page decides its own searchable fields: Rooms (`roomNumber`, `floor`, `type`, current tenant name), Tenants (`firstName`, `lastName`, `phone`, current room number), Billing (room number, tenant name, `invoiceNumber`, `billingMonth` raw + formatted), Invoices (`invoiceNumber`, room number, tenant name, formatted billing month).
- Search state (`searchQuery`) is local `useState` in the page component, matching the rest of the app's "no global state" strategy (see State strategy above).
- Zero-records (nothing created yet) and zero-search-results (records exist, none match) render as two distinct `EmptyState`s — the former keeps its "create the first one" call-to-action, the latter shows a `Search`-icon empty state with a "clear search" action that resets `searchQuery`.

**Deliberately not searchable:** the Dashboard's "recent billing" table (a top-5 preview, not a full list — search belongs on the Billing page it links to) and the per-room/per-tenant billing history shown inside `RoomDetailSheet`/`TenantDetailSheet` (scoped to a single entity, typically a handful of rows). The Settings page has no list data.

# Authentication

Demo, frontend-only authentication gating the entire application, architected so the UI never touches `localStorage` directly and doesn't care which backend answers `login()` — a real backend can replace the demo service later without changing any component.

```
src/auth/
  auth.types.ts      # AuthUser, AuthProvider interface, InvalidCredentialsError
  auth.storage.ts     # session read/write/remove, localStorage-backed, corrupted-data-safe
  auth.service.ts     # LocalAuthService (implements AuthProvider) — the demo credential check
  AuthContext.tsx     # AuthProvider (React context/component) + useAuth()
  index.ts            # barrel: `import { useAuth, AuthProvider } from "@/auth"`

src/components/auth/
  ProtectedApp.tsx        # isLoading -> AuthLoadingScreen; !isAuthenticated -> LoginPage; else children
  AuthLoadingScreen.tsx   # centered LoaderCircle, shown while the session is being restored

src/features/auth/
  LoginPage.tsx   # centered card, branding, LanguageSwitch, LoginForm
  LoginForm.tsx   # fields, validation, submit, password visibility toggle, demo-credential hint
```

**Note on naming:** there are deliberately two different things called `AuthProvider` — the React context component in `AuthContext.tsx` (mirrors the existing `LanguageProvider` naming convention) and the `AuthProvider` *interface* in `auth.types.ts` (the swappable-backend contract, named per the migration design). They never need to be imported into the same file, so the name collision is harmless.

**Auth state (`useAuth()`):** `{ user, isAuthenticated, isLoading, login(email, password), logout() }`. `AuthProvider` (the component) restores the session once on mount (the one `useEffect` in the whole auth module — necessary for the loading-state flow, not incidental), then exposes `login`/`logout` that wrap `authService` and update local `useState`. `logout()` is synchronous UX-wise: it clears the user state immediately and fires `authService.logout()` without awaiting, since the local demo logout has nothing to await for.

**Login flow:** `App.tsx` renders `LanguageProvider > AuthProvider > TooltipProvider > ProtectedApp > RouterProvider`. `ProtectedApp` gates at this top level (not via route redirects, since the whole `RouterProvider` — including the standalone `/invoices/:id` print route — simply doesn't mount until authenticated): loading → `AuthLoadingScreen`, unauthenticated → `LoginPage`, else the real app. `TooltipProvider` had to move from `AppLayout` up to `App.tsx` because `LoginForm`'s password-visibility toggle uses `Tooltip` and renders *before* `AppLayout` ever mounts.

**Login form:** email + password, validated via `validateLogin()` in `src/lib/validation.ts` (same field-error-key convention as the other validators, returning `auth.error.*` keys instead of `validation.*` since the login feature's own translation keys were specified that way). Submit is disabled while a login is in flight; wrong credentials show one generic form-level error (`auth.error.invalidCredentials`) — the service never reveals whether the email or the password was the problem.

**Demo account:** `admin@email.com` / `admin123`, hardcoded in `src/auth/auth.service.ts` (`DEMO_EMAIL`/`DEMO_PASSWORD`/`DEMO_USER`). `DEMO_CREDENTIALS_HINT` is exported for the login page's demo-credential hint box (rendered only when `import.meta.env.DEV` is true) — display-only, so the hint text has a single source of truth instead of being duplicated in `LoginForm`.

**Session storage:** key `rental.auth.session` (i.e. `readValue`/`writeValue("auth.session", ...)` through the shared `storage.ts`, which prefixes with `rental.`). Stores only `{ user: { id, name, email, role } }` — never the password, a hash, or any temporary login state. `readSession()` in `auth.storage.ts` treats both invalid JSON and structurally-wrong shapes as corruption: it clears the key via `removeValue` and returns `null` rather than throwing, so a hand-edited or garbage session value degrades to "logged out," never a crash.

**Logout:** clears the auth session only (`removeSession()` / `AuthContext`'s `user` state). Never touches `rental.rooms` / `rental.tenants` / `rental.assignments` / `rental.billing` / `rental.settings` — logout and application data are unrelated storage keys. The account menu (`AccountMenu` inside `AppHeader.tsx`, a `DropdownMenu` behind a `User` icon button) shows the user's name/email and the logout action, and fires the `auth.logoutSuccess` toast itself (the auth layer stays UI-library-agnostic and doesn't import `sonner`).

**Security limitations (demo only, documented so nobody mistakes this for real security):**
- Everything runs in the browser — there is no server verifying the password.
- The demo credential is a plaintext constant in the frontend source and bundle; anyone can read it.
- The `rental.auth.session` localStorage entry can be edited or forged by hand in devtools to "log in" as anyone.
- This must be replaced by real backend/Firebase Authentication before any production use.

**Future Firebase migration:** implement a `FirebaseAuthService` against the same `AuthProvider` interface (`login`/`logout`/`getCurrentUser`, all `Promise`-returning) and swap the single `export const authService: AuthProvider = new LocalAuthService()` line in `auth.service.ts`. `AuthContext`, `LoginPage`, `LoginForm`, `ProtectedApp`, and the header account menu all depend only on `useAuth()` and never import `auth.service.ts` or `auth.storage.ts` directly, so none of them change.

# Design System

The whole app follows one "clean SaaS admin dashboard" visual language: a soft tinted page background with white/surface cards on top, rounded corners, subtle borders and shadows (never heavy black shadows or glassmorphism), and a purple-led brand palette by default. This is implemented almost entirely as CSS custom properties in `src/index.css` — components consume semantic Tailwind utilities (`bg-primary`, `bg-card`, `text-muted-foreground`, `bg-accent-2`, …) and never hardcode hex colors, so the whole app re-themes from one file. See Theme Architecture below for how those tokens are structured.

**Shared component conventions:**
- **Cards/surfaces** — `bg-card` (always lighter/whiter than the page's `bg-background`), `rounded-xl`/`rounded-2xl` (via the `--radius` scale), `border`, `shadow-sm`. Dialogs and Sheets use `shadow-xl` for more lift since they float above the page.
- **Tables** — outer wrapper is its own `bg-card rounded-xl border shadow-sm` surface (see e.g. `RoomTable.tsx`); `TableHeader` (`src/components/ui/table.tsx`) carries a shared `bg-muted/50` shading so every table gets the same "header row is subtly shaded" look for free.
- **Sidebar** (`AppSidebar.tsx`) — `bg-card` surface distinct from the tinted `bg-background` behind it (so the nav rail always reads as a white/near-white rail); the active nav item is a solid `bg-primary text-primary-foreground` pill, not a light tint — this is themed automatically since `--primary` changes per accent theme.
- **Header** (`AppHeader.tsx`) — `bg-card`, bottom border only, holds (left→right after the title) `LanguageSwitch`, `ThemeMenu`, `AccountMenu`.
- **StatusBadge** (`src/components/common/StatusBadge.tsx`) is the one place that deliberately uses literal Tailwind colors (`emerald-100`/`blue-100`/`amber-100`/`slate-100`/`red-100`, each with a `dark:` variant) instead of theme tokens — status meaning (paid=green, overdue=red, draft=neutral, issued=blue) must stay legible and consistent no matter which accent theme or appearance is active.
- **EmptyState** — icon inside a `bg-accent` circle, `bg-card/60` dashed container; used identically for "no records yet" and "no search results" (see Search below).
- **SearchInput** (`src/components/common/SearchInput.tsx`) — unchanged by this pass; still just consumes `Input`/`Search` icon, so it automatically re-themes with everything else.

**Dashboard summary cards** are the most visually distinctive spot: 4 of the 6 cards use vivid theme fills (`bg-primary`, `bg-accent-2`, `bg-accent-3`, `bg-accent-4` — see Theme Architecture) with white/ink text depending on light/dark; the other 2 stay plain white cards. This mix (not making every card the same color, and not making every card colorful) is deliberate — see `DashboardPage.tsx`'s `SUMMARY_VARIANT_STYLES`.

**Invoice document stays neutral:** `InvoicePrintView.tsx` (the actual invoice content, shared by the preview dialog and the print page) is hardcoded `bg-white text-black` and never imports theme tokens — it must look the same regardless of the active accent theme or dark mode, since it's meant to be printed on paper. Only the *chrome* around it (the preview dialog's header/buttons, the print page's on-screen toolbar) follows the app theme.

# Theme Architecture

Two independent, persisted dimensions, both implemented as CSS custom properties swapped by attributes on `<html>` — no duplicated Tailwind classes per theme, and no CSS-in-JS.

```
src/theme/
  theme.types.ts     # Appearance, AccentTheme unions + defaults + accentThemeTranslationKey()
  theme.storage.ts   # read/write app.appearance / app.accentTheme, corrupted-value-safe
  ThemeContext.tsx   # ThemeProvider (React context/component) + useTheme()
  index.ts           # barrel

src/components/common/
  ThemeMenu.tsx            # compact header/login dropdown: appearance + accent quick-picker
  ThemeAccentSwatches.tsx  # renders another theme's 5 chart-color dots via a local data-theme scope
```

**Appearance** (`"light" | "dark" | "system"`) toggles the `.dark` class on `<html>` — reusing the `@custom-variant dark (&:is(.dark *))` mechanism that was already in `index.css` (previously unreachable, since nothing ever added the class). When appearance is `"system"`, `ThemeContext` resolves it against `window.matchMedia("(prefers-color-scheme: dark)")` and keeps a live listener so the app follows OS theme changes in real time without a refresh. `resolvedAppearance` (always `"light"` or `"dark"`) is what `ThemeMenu`'s trigger icon and any "what's actually rendered" logic should read — `appearance` itself may be `"system"`.

**Accent theme** (`"sky-purple" | "ocean" | "emerald" | "rose"`, default `"sky-purple"`) sets `data-theme="..."` on `<html>`. `src/index.css` defines the neutral tokens (`--background`, `--foreground`, `--card`, `--border`, `--muted`, `--destructive`, `--sidebar*`) once for light (`:root`) and once for dark (`.dark`) — these do **not** vary per accent theme, only per light/dark, matching the "surfaces stay neutral, only the brand hue changes" convention most multi-theme SaaS products use. The accent-carrying tokens (`--primary`, `--secondary`, `--accent`, `--ring`, `--chart-1..5`, `--accent-2/3/4`, `--sidebar-primary`, `--sidebar-accent`) are redefined four times over — `[data-theme="X"]` for light, `.dark[data-theme="X"]` for dark — for each of the four themes. `:root`/`.dark` alone (no attribute selector) hold the Sky Purple values as the fallback, so an unset/invalid `data-theme` still looks correct.

**`--chart-1..5`** hold each theme's *exact* published palette (Sky Purple's are the literal `#4B49AC #98BDFF #7DA0FA #7978E9 #F3797E` from the design brief) — reserved for future chart/legend use and for the swatch previews in `ThemeAccentSwatches`/Settings, so they must stay pixel-accurate.

**`--accent-2/-3/-4`** (+ matching `-foreground`) are a separate set, purpose-built for the Dashboard's vivid stat-card fills: light-mode values are pre-darkened for ~4.5:1+ contrast with white text; dark-mode values are pre-brightened and paired with a dark-ink foreground (`#15151D`) instead of white — light-mode fill+white-text / dark-mode fill+dark-text is the contrast convention used for every accent token in this system, so no component ever has to branch on light vs. dark to pick a readable text color.

**`ThemeAccentSwatches`** renders a theme's 5 chart dots correctly *no matter which theme is currently active on `<html>`* — it puts `data-theme="ocean"` (etc.) on its own wrapper `div`, and since CSS custom properties cascade down from whatever element defines them, that subtree sees Ocean's `--chart-*` values even while the rest of the page is Rose. This is what makes the Settings theme-picker cards (and the header's quick-picker swatch dots) able to preview all 4 themes simultaneously.

**Anti-flash:** `index.html` has a small inline `<script>` before `<title>`'s sibling content that reads `app.appearance`/`app.accentTheme` synchronously and sets the `.dark` class / `data-theme` attribute before React ever mounts — otherwise the app would flash the default theme for one frame on every load. `ThemeContext`'s own effects duplicate this same logic (necessarily — the inline script can't call React state setters), so the two must be kept in sync if the storage format ever changes.

**Persistence:** `app.appearance` and `app.accentTheme`, both unprefixed (no `rental.` prefix) — same convention as `app.language`, since these are UI preferences, not property data. `theme.storage.ts` reads/writes `localStorage` directly (like `LanguageProvider` does) rather than going through the repository `storage.ts` layer, for the same reason. Invalid/missing/corrupted values fall back to their defaults (`"system"` / `"sky-purple"`) safely — never a crash.

**How to add a new accent theme (e.g. `"sunset"`):**
1. Add `"sunset"` to the `AccentTheme` union in `theme.types.ts` and to the `ACCENT_THEMES` array.
2. Add a `[data-theme="sunset"] { ... }` block and a `.dark[data-theme="sunset"] { ... }` block to `src/index.css`, defining all of `--primary/-foreground`, `--secondary/-foreground`, `--accent/-foreground`, `--ring`, `--chart-1..5`, `--accent-2/3/4` (+ `-foreground`), `--sidebar-primary/-foreground`, `--sidebar-accent/-foreground`, `--sidebar-ring` — light fills pair with white text, dark fills pair with `#15151D` ink text.
3. Add `theme.sunset` to `Translations` (`src/i18n/types.ts`) and both dictionaries.
4. Update the inline anti-flash script's `accent` allow-list in `index.html` if it's meant to be selectable before first paint (it already generically allows anything in that list — just add the new key there too).

No component beyond those four spots needs to change — `ThemeMenu`, the Settings accent cards, and the Dashboard stat cards all just read `ACCENT_THEMES`/tokens generically.

# Domain Model

- **Room** (`src/types/room.ts`) — `id, roomNumber, floor?, type?, monthlyRent, status, description?, electricityRate, waterRate, createdAt, updatedAt`. `status: "available" | "occupied" | "maintenance" | "inactive"`. Never stores a tenant reference.
- **Tenant** (`src/types/tenant.ts`) — `id, firstName, lastName, phone?, email?, identificationNumber?, address?, emergencyContactName?, emergencyContactPhone?, status, notes?, createdAt, updatedAt`. `status: "active" | "inactive"`.
- **RoomTenantAssignment** (`src/types/assignment.ts`) — `id, roomId, tenantId, startDate, endDate?, status, createdAt`. `status: "active" | "ended"`. This is the **only** source of truth for which tenant occupies which room — resolve "current tenant for room X" via `assignmentRepository.getActiveByRoomId(roomId)`, never via a field on `Room`.
- **BillingRecord** (`src/types/billing.ts`) — `id, roomId, tenantId?, invoiceNumber?, billingMonth ("YYYY-MM"), electricity: MeterReading, water: MeterReading, rentAmount, otherCharges: BillingCharge[], subtotal, total, status, issuedAt?, dueDate?, paidAt?, createdAt, updatedAt`. `status: "draft" | "issued" | "paid" | "overdue"`. `invoiceNumber` is only set once the record is issued. There is no dedicated garbage-fee/meter-maintenance-fee field — every optional charge, fixed or one-off, lives in `otherCharges`.
- **BillingCharge** — `id, masterId?, name, amount`. `masterId` links back to an `OtherChargeMaster` row when the charge was added from the master list; it's absent for a one-time custom charge typed directly on a bill. `name`/`amount` are a snapshot at the time the charge was added to this specific bill — editing them here never changes the master record, and vice versa.
- **OtherChargeMaster** (`src/types/otherCharge.ts`) — `id, nameTh, nameEn?, defaultAmount, isActive, createdAt, updatedAt`. Reusable master data for *optional* per-bill charges (garbage, meter maintenance, parking, internet, cleaning, etc.). Master rows are never automatically added to a bill — a user explicitly picks one from the Settings-managed list when creating/editing a `BillingRecord`, at which point its `defaultAmount` is copied into a new `BillingCharge` that can then be edited per bill without touching the master.
- **MeterReading** — `previousMeter, currentMeter, usage, rate, amount` (shape shared by electricity and water).
- **PropertySettings** (`src/types/settings.ts`) — single record: property name/address/phone plus the three true monthly defaults (`defaultElectricityRate`, `defaultWaterRate`, `defaultInvoiceNote`), used to prefill new rooms and billing records. Fixed/optional fee amounts (garbage, meter maintenance, etc.) are **not** stored here — see `OtherChargeMaster` below.

**Important relations:** there is no separate `Invoice` entity. The Invoices page is a filtered/formatted view over `BillingRecord` (only records with `invoiceNumber` set, i.e. not `draft`) — this was a deliberate decision to avoid two sources of truth for the same data, since the original spec's "Monthly Billing Table" and "Invoice Management" sections share almost all their columns.

# Business Rules

- **Assignment exclusivity:** `assignmentRepository.assign()` ends any existing active assignment for that room before creating the new one, then sets `Room.status = "occupied"`. Only one active assignment per room at a time.
- **Ending a tenancy:** `assignmentRepository.endByRoomId()` sets the assignment to `ended` and sets `Room.status = "available"` — but only if the room's current status is `occupied` (an explicit `maintenance`/`inactive` status is left alone, since ending occupancy shouldn't silently clear a maintenance flag).
- **Moving a tenant to a different room:** the Tenants page's assign flow checks for an existing active assignment for that tenant before assigning the new one, and ends the old one first if the room differs (`TenantsPage.tsx`).
- **Meter usage:** `usage = Math.max(0, currentMeter - previousMeter)` (`src/lib/calculations.ts`) — never negative.
- **Billing totals:** `subtotal = electricity.amount + water.amount + rentAmount`; `total = subtotal + sum(otherCharges.amount)` (`calculateBillingTotals` in `src/lib/calculations.ts`). There are no separate fixed-fee fields in the total — every optional charge, whether master-derived or custom, is just an `otherCharges` entry.
- **Invoice numbering:** `INV-{YYYY}-{MM}-{seq3}`, where `seq` is one more than the highest existing sequence number among records sharing that year+month (`generateInvoiceNumber` in `src/lib/invoice.ts`). There is no separate counter in storage — the number is derived from existing records every time, so it stays correct even after seeding or deletions.
- **Billing status lifecycle:** stored `status` changes only via explicit user actions — "Issue" (`draft -> issued`, assigns `invoiceNumber`) and "Mark as Paid" (`-> paid`). `overdue` is never written to storage; `resolveBillingStatus()` in `src/lib/invoice.ts` computes it at read-time (bumps `issued` to `overdue` when `dueDate` has passed) purely for display.
- **Room status behavior:** new rooms default to `status: "available"` unless specified; occupancy is otherwise only changed by the assignment flow above.
- **Validation** (`src/lib/validation.ts`): room number required, monthly rent / rates ≥ 0; tenant first/last name required; billing current meter ≥ previous meter (both utilities), rent ≥ 0.
- **Delete behavior:** every delete (room/tenant/billing) goes through `ConfirmDialog` (a Radix `AlertDialog` wrapper), never `window.confirm`. Every mutation shows a `sonner` toast.

# Feature Status

| Feature | Status | Notes |
|---|---|---|
| Authentication (Login/Logout) | Done | Demo-only frontend auth via `AuthProvider`/`useAuth()`; gates the whole app through `ProtectedApp` — see Authentication above |
| Session Persistence | Done | `rental.auth.session` in `localStorage`; restored on load, survives refresh, safely discarded if corrupted |
| Theme System | Done | Appearance (light/dark/system) + 4 accent themes via `useTheme()`; persisted, applies instantly, no flash on load — see Theme Architecture above |
| Dark Mode | Done | Deep slate/navy neutrals (not pure black); all 4 accent themes have tuned dark variants |
| Dashboard | Done | Summary cards (theme-driven fills), room status overview, recent billing, quick actions |
| Rooms | Done | CRUD, detail sheet with billing history, assign/end tenancy, client-side search |
| Tenants | Done | CRUD, detail sheet, assign/move room, client-side search |
| Assignments | Done | Exclusive active assignment per room, move-room handling |
| Billing | Done | Auto-calculated usage/totals, other charges, desktop table + mobile cards, client-side search |
| Invoices | Done | List, in-app preview dialog, standalone print page, auto invoice numbering, client-side search |
| Print Invoice | Done | `/invoices/:id` standalone route, `@media print` + `@page A4`, browser print/Save-as-PDF |
| Settings | Done | Property info + the 3 true billing defaults (electricity rate, water rate, invoice note), plus a separate Other Charge Master (optional per-bill charges); used by new rooms and billing — see Data Migration History |
| Responsive | Done | Verified at 375/768/1024/1440px via headless Chrome screenshots; sidebar becomes a Sheet drawer under `md`, billing table becomes cards under `md` |
| Localization (Thai/English) | Done | Every user-facing string routed through `t()`; verified live in-browser for both languages, including the bilingual invoice document, `{{param}}` interpolation, and `localStorage` persistence |

# Storage Keys

All defined in `src/data/storage/storage.ts` (`STORAGE_KEYS`), stored under the `rental.` prefix:

- `rental.rooms`
- `rental.tenants`
- `rental.assignments`
- `rental.billing`
- `rental.settings`
- `rental.otherCharges`

Plus non-domain keys (none `rental.`-prefixed except the auth session, which follows its own established key name): `app.language` (see Localization Architecture) holding `"th"` or `"en"`; `rental.auth.session` (see Authentication) holding `{ user }` or absent; `app.appearance` (see Theme Architecture) holding `"light" | "dark" | "system"`; `app.accentTheme` holding `"sky-purple" | "ocean" | "emerald" | "rose"`.

# Data Migration History

**2026-08-10 — Fixed-fee-to-master-data migration.** `PropertySettings` used to carry `defaultGarbageFee`/`defaultElectricityMeterMaintenanceFee`/`defaultWaterMeterMaintenanceFee`, and `BillingRecord` mirrored them as dedicated scalar fields (`garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee`), auto-applied to every new bill. These were replaced by `OtherChargeMaster` (optional, explicitly attached per bill) and folded into `BillingRecord.otherCharges`. `src/data/migrations/legacyChargeMigration.ts`, called unconditionally from `main.tsx` (not nested inside `seedIfEmpty()`, since that only runs on a truly empty install), performs a one-time idempotent migration: seeds 7 example `OtherChargeMaster` rows (using any pre-existing legacy settings values where present), converts any pre-existing `BillingRecord`'s nonzero legacy fee fields into `otherCharges` entries linked back to the matching seeded master by name, and strips the legacy fields from both collections. Safe to re-run — once the legacy fields are gone from a record, there's nothing left to migrate.

# Firebase Migration

**Status: Phase 1 — Data Model Designed.** The implementation remains frontend-only and continues to use the existing localStorage repositories unchanged. The Firestore target model and migration plan are documented in `docs/firebase/data-model.md`; prospective document interfaces live in `src/types/firestore/*` and are intentionally separate from the current local-storage types.

Key decisions: use top-level property-scoped collections (`propertyId` on all business documents), store Firestore `Timestamp` values for persisted dates, preserve room/tenant/charge snapshots on billing records, and retain assignment history as the occupancy authority. Invoice screens remain a projection of issued `BillingRecord`s—there is no `invoices` collection unless a later requirement introduces independent invoice state or audit history. Firebase Authentication will own credentials; `users/{uid}` stores only the application profile and property memberships. Future assignment, billing issuance, and invoice-number writes must be API/transaction controlled.

# Important Files

| Path | Responsibility |
|---|---|
| `src/app/router.tsx` | Route table |
| `src/app/AppLayout.tsx` | Sidebar + header shell, `<Outlet/>`, toaster mount |
| `src/data/storage/storage.ts` | Generic localStorage read/write helpers |
| `src/data/repositories/*` | CRUD + domain logic per entity; the only code that touches `storage.ts` |
| `src/data/seed/seedData.ts` | One-time idempotent demo data seeding, called from `src/main.tsx` |
| `src/types/otherCharge.ts` | `OtherChargeMaster` type + create/update input types |
| `src/data/repositories/otherChargeRepository.ts` | CRUD for the Other Charge Master list |
| `src/hooks/useOtherCharges.ts` | Reactive wrapper around `otherChargeRepository` |
| `src/data/migrations/legacyChargeMigration.ts` | One-time idempotent legacy-fee-to-master-data migration, run from `main.tsx` |
| `src/features/settings/OtherChargeSection.tsx`, `OtherChargeTable.tsx`, `OtherChargeFormDialog.tsx` | Other Charge Master management UI on the Settings page |
| `src/hooks/use*.ts` | Thin reactive wrappers around repositories, consumed by feature pages |
| `src/lib/calculations.ts` | Meter usage / billing total math |
| `src/lib/invoice.ts` | Invoice number generation, display-time status resolution |
| `src/lib/validation.ts` | Form validators returning field-keyed error messages |
| `src/lib/currency.ts`, `src/lib/date.ts` | Language-aware THB currency formatting, Thai/English date formatting |
| `src/lib/search.ts` | `matchesSearch()` — shared case-insensitive substring matcher used by every list page's search filter |
| `src/components/common/SearchInput.tsx` | Shared search box (shadcn `Input` + `Search` icon) used identically on Rooms/Tenants/Billing/Invoices |
| `src/components/common/LanguageSwitch.tsx` | Shared ไทย/EN toggle, used in both `AppHeader` and `LoginPage` |
| `src/auth/auth.types.ts` | `AuthUser`, the swappable `AuthProvider` interface, `InvalidCredentialsError` |
| `src/auth/auth.storage.ts` | `rental.auth.session` read/write/remove; treats invalid JSON or wrong shape as "logged out", never throws |
| `src/auth/auth.service.ts` | `LocalAuthService` (demo credential check) — the only file that knows the demo email/password |
| `src/auth/AuthContext.tsx` | `AuthProvider` (React context) + `useAuth()` — session restore on mount, `login`/`logout` |
| `src/components/auth/ProtectedApp.tsx` | Top-level auth gate: loading screen / `LoginPage` / the real app |
| `src/features/auth/LoginPage.tsx`, `LoginForm.tsx` | Login UI — branding, form validation, password visibility toggle, demo-credential hint |
| `src/theme/theme.types.ts` | `Appearance`/`AccentTheme` unions, defaults, `accentThemeTranslationKey()` |
| `src/theme/theme.storage.ts` | `app.appearance`/`app.accentTheme` read/write, corrupted-value-safe |
| `src/theme/ThemeContext.tsx` | `ThemeProvider` (React context) + `useTheme()` — resolves `"system"`, applies `.dark`/`data-theme` to `<html>` |
| `src/components/common/ThemeMenu.tsx` | Compact appearance + accent quick-picker, shared by `AppHeader` and `LoginPage` |
| `src/components/common/ThemeAccentSwatches.tsx` | Renders any theme's 5 chart-color dots via a locally-scoped `data-theme` override |
| `index.html` | Inline anti-flash script — applies persisted theme before React mounts |
| `src/i18n/types.ts` | `Language` union, the `Translations` interface (single source of truth for every key) |
| `src/i18n/index.ts` | `LanguageProvider`, `useLanguage()`, `t()` lookup + `{{param}}` interpolation, dictionary registry |
| `src/i18n/translations/{en,th}.ts` | The two language dictionaries, each typed `: Translations` |
| `src/features/invoices/InvoicePrintView.tsx` | The invoice document markup (bilingual via `t()`), shared by the preview dialog and the print page |
| `src/features/invoices/InvoicePrintPage.tsx` | Standalone `/invoices/:id` route (no `AppLayout`, but still inside `LanguageProvider`) |
| `src/components/ui/*` | Hand-authored Radix-based primitives (see shadcn/ui note above) |

# Known Limitations

- Frontend only — no backend, no authentication, no real database.
- Single property only — no multi-property support.
- No real PDF generation service — invoice "export" is the browser's native print / Save-as-PDF.
- No automated recurring monthly billing generation.
- No notifications (email/SMS/push).
- Only two languages ship (Thai, English); adding more is low-effort by design (see Localization Architecture) but not yet done.

# Future Improvements

- Firebase Authentication (the app currently has none)
- Firestore as the repository backing store (swap repository internals to `async`, per the Architecture section above)
- Firebase Storage for any uploaded documents/photos
- Multi-property support
- Payment tracking / partial payments
- Cloud-generated invoice PDFs (rather than browser print)
- Automated monthly billing generation
- Notifications (payment reminders, overdue alerts)
- Additional languages (Japanese, Korean, Chinese) — see "How to add a new language" under Localization Architecture

# Development Guidelines

- Read this file before modifying the project.
- Preserve TypeScript strict mode; do not introduce `any`.
- Keep business/billing calculations in `src/lib/*`, never inline in components.
- Keep all `localStorage` access behind `src/data/repositories/*` — components and hooks must not call `localStorage` directly.
- Never hardcode user-facing strings in components — add a key to `Translations` (`src/i18n/types.ts`) and both dictionaries, then call `t("...")`. Never write `language === "th" ? ... : ...` inline.
- Keep `src/lib/validation.ts` free of any `src/i18n/` import — validators return translation keys, not literal messages; the calling component translates.
- Update this file after any meaningful architecture or feature change.
- Do not replace the repository/hook architecture (or the no-separate-Invoice-model decision) without documenting why here first.
- If re-introducing the `shadcn` CLI, verify generated files actually land in `src/components/ui/` before trusting its output (see the shadcn/ui note above).
