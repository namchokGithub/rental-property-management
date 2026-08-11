# Project Overview

Web application for managing rental rooms/apartments/dormitory rooms. A property owner/admin manages rooms, tenants, tenant-room assignments, monthly utility and rent billing, invoice generation/printing, and property settings from a responsive admin dashboard. There is no backend of any kind — the React app talks to Firebase Authentication and Cloud Firestore directly from the browser, through a repository layer (`src/data/repositories/*`) that feature/UI code never bypasses. Firestore Security Rules (`firestore.rules`) are the sole authorization boundary; see Authentication and Firebase Migration below.

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
- Firebase JS SDK v12 (`firebase/auth`, `firebase/firestore`) — modular imports only through `src/lib/firebase/*`; no `firebase-admin`, no Cloud Functions
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

No global state library and no app-wide Context for business data (there is a small `AuthContext`/`ThemeContext`/`LanguageContext` for cross-cutting concerns — see their own sections below). Each domain has a thin custom hook (`src/hooks/use*.ts`) wrapping its repository: `useRooms`, `useTenants`, `useAssignments`, `useBillingRecords`, `useSettings`, `useOtherCharges`. Every hook subscribes to its Firestore collection/document via `onSnapshot()` on mount and holds the live result in `useState`; there is no `refresh()` anywhere — a mutation's effect on the UI comes from the same `onSnapshot` callback firing again once the write commits, the same path that delivers another user's/tab's concurrent changes. Every hook additionally returns `isLoading: boolean` (`true` until the first snapshot arrives), since the initial read is now an async round trip instead of a synchronous `localStorage` read; pages gate their render with `if (isLoading) return <PageSpinner />;` before rendering the rest of their (otherwise unchanged) body. UI-only state (dialog open/closed, selected row, form fields) is local `useState` in the component that owns it.

## Repository architecture

```
src/lib/firebase/
  app.ts, auth.ts, firestore.ts, config.ts, emulators.ts, index.ts   # Firebase App/Auth/Firestore client boundary
src/data/repositories/
  converters/timestamp.ts   # timestampToIso / isoToTimestamp — Firestore Timestamp <-> ISO string, at the repository boundary only
  firestoreCrud.ts           # generic single-subcollection CRUD factory (getAll/subscribe/create/update/delete), reused by rooms + tenants
  roomRepository.ts          # firestoreCrud("rooms") + an active-assignment delete guard
  tenantRepository.ts        # firestoreCrud("tenants") + the same delete guard, keyed on tenantId
  assignmentRepository.ts    # hand-written: subscribe(); assign()/endByRoomId() each run inside runTransaction()
  billingRepository.ts       # hand-written: subscribe(); create() checks-then-writes a deterministic doc ID; update() issues invoiceNumber transactionally
  settingsRepository.ts      # get/update/subscribe against one document, properties/{propertyId}/settings/general
  otherChargeRepository.ts   # create/update/delete operate on that same document's embedded otherChargeMasters array, via runTransaction() read-modify-write
```

Components and hooks never import `firebase/*` or call Firestore APIs directly — only repository modules do, and only through `db`/`auth` exported from `src/lib/firebase`. Every repository function takes `propertyId` as an explicit parameter (resolved once, at the call site, via `getActivePropertyId(user.propertyIds)` in `src/lib/activeProperty.ts`) and never re-derives it internally — introducing a future multi-property switcher only changes call sites, not repository internals. There is no `localStorage`-backed repository left; `src/data/storage/storage.ts` (the old generic `localStorage` CRUD helper) was deleted once nothing referenced it.

## localStorage usage (UI preferences only)

Every domain collection (rooms, tenants, assignments, billing, settings, other charges) now lives in Firestore — see Firebase Migration and Storage Keys below. The only `localStorage` access left in the app is for three UI preferences, each read/written directly (not through a repository) by the module that owns it: `app.language` (`src/i18n/index.ts`), `app.appearance`/`app.accentTheme` (`src/theme/theme.storage.ts`). None of these use the old `rental.` prefix, since they are not property data.

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

**Language Context.** `LanguageProvider` (in `src/i18n/index.ts`) wraps the whole app in `src/app/App.tsx`, _outside_ `RouterProvider` — this matters because `/invoices/:id` is a standalone route with no `AppLayout`, but it still needs language context. `useLanguage()` returns `{ language, setLanguage, t }`. Every component that renders user-facing text calls this hook directly; there is no prop-drilling of translations.

**Translation keys** are nested per feature/domain, e.g. `common.save`, `room.roomNumber`, `billing.total`, `invoice.remark`, `validation.room.roomNumberRequired`. `Translations` in `types.ts` is the single source of truth for the shape — both `en.ts` and `th.ts` are typed `: Translations`, so TypeScript itself guarantees every key exists in both languages (no runtime drift possible).

**`t(key, params?)`** looks up the dotted key in the current language's dictionary. If the key doesn't resolve, it returns the raw key string (per spec — never throws, never silently blanks). For dynamic content (e.g. "Delete room 101?"), translation strings contain `{{paramName}}` placeholders and `t()` does simple string substitution: `t("room.deleteConfirmTitle", { roomNumber: "101" })` → `"Delete room 101?"` / `"ต้องการลบห้อง 101 หรือไม่?"`. This is the _only_ mechanism for dynamic text — never build strings with `language === "th" ? ... : ...` inline in a component.

**Locale-aware formatters** live alongside the existing calculation helpers, not inside `src/i18n/`, since they're pure formatting utilities already established in `src/lib/`:

- `formatCurrency(amount, language)` (`src/lib/currency.ts`) — `th` → `฿1,200.00` (`Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" })`); `en` → `THB 1,200.00` (`Intl.NumberFormat("en-US", { ..., currencyDisplay: "code" })`).
- `formatDate(iso, language)` and `formatBillingMonth(billingMonth, language)` (`src/lib/date.ts`) — `th` → `th-TH` locale (renders the Buddhist-era year automatically, e.g. `10 สิงหาคม 2569`); `en` → `en-US` locale (e.g. `August 10, 2026`).

**Status labels** (`StatusBadge`) and the invoice document's status line both resolve through the same `status.*` keys (`status.available`, `status.issued`, etc.) — there is exactly one source of truth for status labels, not the two independent hardcoded maps (English in `StatusBadge`, Thai in `InvoicePrintView`) that existed before this pass.

**Validation messages** (`src/lib/validation.ts`) return translation _keys_ (e.g. `"validation.room.roomNumberRequired"`), never literal strings — the validators stay language-agnostic, and the component displaying the error calls `t(errors.fieldName)`. This is what keeps localization "completely isolated from business logic" per the requirement: `src/lib/validation.ts` has zero imports from `src/i18n/`.

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
- Each page decides its own searchable fields: Rooms (`roomNumber`, `floor`, `type`, current tenant name), Tenants (`name`, `phone`, current room number), Billing (room number, tenant name, `invoiceNumber`, `billingMonth` raw + formatted), Invoices (`invoiceNumber`, room number, tenant name, formatted billing month).
- Search state (`searchQuery`) is local `useState` in the page component, matching the rest of the app's "no global state" strategy (see State strategy above).
- Zero-records (nothing created yet) and zero-search-results (records exist, none match) render as two distinct `EmptyState`s — the former keeps its "create the first one" call-to-action, the latter shows a `Search`-icon empty state with a "clear search" action that resets `searchQuery`.

**Deliberately not searchable:** the Dashboard's "recent billing" table (a top-5 preview, not a full list — search belongs on the Billing page it links to) and the per-room/per-tenant billing history shown inside `RoomDetailSheet`/`TenantDetailSheet` (scoped to a single entity, typically a handful of rows). The Settings page has no list data.

# Authentication

Real authentication, with no backend of any kind: Firebase Authentication (email/password) issues the session, and the application profile — `name`, `email`, `role`, `propertyIds` — is read directly from Firestore at `users/{uid}` once signed in. There is no `/auth/me` endpoint, no API client, no `ApiError` — a missing/inactive profile is handled the same way `getDoc(...).exists() === false` is handled everywhere else in Firestore code: `null`, not a thrown/typed error. The UI still never touches Firebase directly outside `src/auth/*` — every component calls `useAuth()`.

```
src/auth/
  auth.types.ts      # AuthUser { id, name, email, role: "admin" | "staff", propertyIds }, AuthRole,
                       # AuthProvider interface, InvalidCredentialsError
  auth.service.ts     # FirebaseAuthService (implements AuthProvider) — signInWithEmailAndPassword/signOut,
                       # plus fetchUserProfile(uid) — a plain getDoc(doc(db, "users", uid)) call, exported
                       # standalone so AuthContext can call it directly on every onAuthStateChanged fire
  AuthContext.tsx     # AuthProvider (React context/component) + useAuth() — restores/updates via
                       # firebase/auth's onAuthStateChanged, not a one-shot check
  index.ts            # barrel: `import { useAuth, AuthProvider } from "@/auth"`

src/components/auth/
  ProtectedApp.tsx        # isLoading -> AuthLoadingScreen; !isAuthenticated -> LoginPage; else children
  AuthLoadingScreen.tsx   # centered LoaderCircle, shown while the session is being restored

src/features/auth/
  LoginPage.tsx   # centered card, branding, LanguageSwitch, LoginForm
  LoginForm.tsx   # fields, validation, submit, password visibility toggle, real Firebase network-error handling
```

**Note on naming:** there are deliberately two different things called `AuthProvider` — the React context component in `AuthContext.tsx` (mirrors the existing `LanguageProvider` naming convention) and the `AuthProvider` _interface_ in `auth.types.ts` (the swappable-backend contract). They never need to be imported into the same file, so the name collision is harmless.

**Auth state (`useAuth()`):** unchanged shape — `{ user, isAuthenticated, isLoading, login(email, password), logout() }`.

**Session restoration:** `AuthContext.tsx` subscribes to `onAuthStateChanged(auth, ...)` once on mount. Every fire (initial restore, post-login, post-logout) that reports a Firebase user calls `fetchUserProfile(firebaseUser.uid)` and sets `user` from the Firestore document; a `null` Firebase user clears it. A `loadedUidRef` skips a redundant profile refetch when the callback fires again for a uid already loaded (e.g. right after `login()` already set it). `isLoading` stays `true` until the first callback resolves, so `ProtectedApp` never flashes protected content before Firebase settles.

**Login flow:** `App.tsx` still renders `LanguageProvider > AuthProvider > TooltipProvider > ProtectedApp > RouterProvider`, unchanged. `login()` calls Firebase `signInWithEmailAndPassword`, translates known invalid-credential error codes (`auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found`, `auth/invalid-email`) into `InvalidCredentialsError`, then calls `fetchUserProfile()` and returns the profile directly (in addition to the `onAuthStateChanged` listener's own — idempotent — update). If the Firestore profile is missing or `isActive: false`, `login()` signs the Firebase user back out and throws `InvalidCredentialsError` — the same generic message a wrong password gets, so the login form never reveals whether an email exists or is merely deactivated. `LoginForm` shows `auth.error.network` for a genuine network failure and `auth.error.invalidCredentials` for everything else.

**No 401/403 distinction anymore** — that was HTTP-status-driven, from the now-deleted backend. `onAuthStateChanged` firing with a Firebase user already means the token itself is valid; the only remaining question is whether `users/{uid}` exists and is active, which collapses to the single `fetchUserProfile()` returning `null` or a real profile. A `null` profile leaves `user` as `null` (so `LoginPage` shows) without signing the Firebase user out — functionally the same outcome the old "don't auto-logout on 403" rule produced, just without a status code driving it.

**Logout:** `logout()` clears `user` state and calls Firebase `signOut()` (fire-and-forget). Never touches Firestore or `app.language`/`app.appearance`/`app.accentTheme`. The account menu (`AccountMenu` inside `AppHeader.tsx`) is unchanged — still reads `user.name`/`user.email` and fires the `auth.logoutSuccess` toast itself.

**Removed (this migration):** the entire Cloud Functions backend (`functions/`), the REST API client (`src/api/client.ts`, `src/api/errors.ts`), `src/auth/auth.storage.ts` (the old `rental.auth.session` localStorage session — Firebase's own SDK session persistence replaces it), the demo credential hint box on `LoginPage`, and the `VITE_API_BASE_URL`/`VITE_FIREBASE_FUNCTIONS_REGION` env vars.

**Authorization boundary:** `role: "admin"` may write anywhere the user has property access (`propertyIds`); `role: "staff"` may only read. This is enforced by [firestore.rules](firestore.rules) — the only trustworthy enforcement point, since there is no server — and mirrored in the UI as a convenience: every page hides its create/edit/delete/issue/mark-paid affordances for a `staff` user (inline `user?.role === "admin"` checks at each button, no shared `<RequireRole>` abstraction). A `staff` user who somehow triggers a write anyway (e.g. via devtools) gets a rejected Firestore write, not a security hole. See Firebase Migration below for the full rules and schema.

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

**Invoice document stays neutral:** `InvoicePrintView.tsx` (the actual invoice content, shared by the preview dialog and the print page) is hardcoded `bg-white text-black` and never imports theme tokens — it must look the same regardless of the active accent theme or dark mode, since it's meant to be printed on paper. Only the _chrome_ around it (the preview dialog's header/buttons, the print page's on-screen toolbar) follows the app theme.

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

**`--chart-1..5`** hold each theme's _exact_ published palette (Sky Purple's are the literal `#4B49AC #98BDFF #7DA0FA #7978E9 #F3797E` from the design brief) — reserved for future chart/legend use and for the swatch previews in `ThemeAccentSwatches`/Settings, so they must stay pixel-accurate.

**`--accent-2/-3/-4`** (+ matching `-foreground`) are a separate set, purpose-built for the Dashboard's vivid stat-card fills: light-mode values are pre-darkened for ~4.5:1+ contrast with white text; dark-mode values are pre-brightened and paired with a dark-ink foreground (`#15151D`) instead of white — light-mode fill+white-text / dark-mode fill+dark-text is the contrast convention used for every accent token in this system, so no component ever has to branch on light vs. dark to pick a readable text color.

**`ThemeAccentSwatches`** renders a theme's 5 chart dots correctly _no matter which theme is currently active on `<html>`_ — it puts `data-theme="ocean"` (etc.) on its own wrapper `div`, and since CSS custom properties cascade down from whatever element defines them, that subtree sees Ocean's `--chart-*` values even while the rest of the page is Rose. This is what makes the Settings theme-picker cards (and the header's quick-picker swatch dots) able to preview all 4 themes simultaneously.

**Anti-flash:** `index.html` has a small inline `<script>` before `<title>`'s sibling content that reads `app.appearance`/`app.accentTheme` synchronously and sets the `.dark` class / `data-theme` attribute before React ever mounts — otherwise the app would flash the default theme for one frame on every load. `ThemeContext`'s own effects duplicate this same logic (necessarily — the inline script can't call React state setters), so the two must be kept in sync if the storage format ever changes.

**Persistence:** `app.appearance` and `app.accentTheme`, both unprefixed (no `rental.` prefix) — same convention as `app.language`, since these are UI preferences, not property data. `theme.storage.ts` reads/writes `localStorage` directly (like `LanguageProvider` does) rather than going through a Firestore repository, for the same reason: UI preferences aren't business data. Invalid/missing/corrupted values fall back to their defaults (`"system"` / `"sky-purple"`) safely — never a crash.

**How to add a new accent theme (e.g. `"sunset"`):**

1. Add `"sunset"` to the `AccentTheme` union in `theme.types.ts` and to the `ACCENT_THEMES` array.
2. Add a `[data-theme="sunset"] { ... }` block and a `.dark[data-theme="sunset"] { ... }` block to `src/index.css`, defining all of `--primary/-foreground`, `--secondary/-foreground`, `--accent/-foreground`, `--ring`, `--chart-1..5`, `--accent-2/3/4` (+ `-foreground`), `--sidebar-primary/-foreground`, `--sidebar-accent/-foreground`, `--sidebar-ring` — light fills pair with white text, dark fills pair with `#15151D` ink text.
3. Add `theme.sunset` to `Translations` (`src/i18n/types.ts`) and both dictionaries.
4. Update the inline anti-flash script's `accent` allow-list in `index.html` if it's meant to be selectable before first paint (it already generically allows anything in that list — just add the new key there too).

No component beyond those four spots needs to change — `ThemeMenu`, the Settings accent cards, and the Dashboard stat cards all just read `ACCENT_THEMES`/tokens generically.

# Domain Model

Every type below is both the TypeScript domain type (`src/types/*.ts`) and the shape a Firestore repository reads/writes — there is no separate local/Firestore type split. Fields typed `string` for a date/time (`startDate`, `createdAt`, etc.) are ISO strings in memory; the repository layer converts to/from Firestore `Timestamp` at the boundary (`src/data/repositories/converters/timestamp.ts`) so nothing above it ever sees a raw `Timestamp`. `id` is the Firestore document ID (assigned by `addDoc`/`doc()`, not client-generated, except inside `otherChargeMasters` — see below).

- **Room** (`src/types/room.ts`) — `id, roomNumber, floor?, type?, monthlyRent, status, description?, electricityRate, waterRate, createdAt, updatedAt`. `status: "available" | "occupied" | "maintenance" | "inactive"`. Never stores a tenant reference. Firestore path: `properties/{propertyId}/rooms/{roomId}`.
- **Tenant** (`src/types/tenant.ts`) — `id, name, phone?, email?, identificationNumber?, address?, emergencyContactName?, emergencyContactPhone?, status, notes?, createdAt, updatedAt`. `status: "active" | "inactive"`. `name` is a single free-text field (not split first/last) — see Data Migration History. Firestore path: `properties/{propertyId}/tenants/{tenantId}`.
- **RoomTenantAssignment** (`src/types/assignment.ts`) — `id, roomId, tenantId, startDate, endDate?, status, createdAt, updatedAt`. `status: "active" | "ended"`. This is the **only** source of truth for which tenant occupies which room — resolve "current tenant for room X" via `useAssignments().getActiveByRoomId(roomId)`, never via a field on `Room`. `updatedAt` (added for the Firestore migration) has no reader of its own — `assignmentRepository.assign()` writes it on the tenant's own document as a no-op touch purely to give Firestore's optimistic-concurrency check something to serialize two concurrent assignment attempts against; see Business Rules. Firestore path: `properties/{propertyId}/assignments/{assignmentId}`.
- **BillingRecord** (`src/types/billing.ts`) — `id, roomId, tenantId?, invoiceNumber?, billingMonth ("YYYY-MM"), electricity: MeterReading, water: MeterReading, rentAmount, otherCharges: BillingCharge[], subtotal, total, status, issuedAt?, dueDate?, paidAt?, createdAt, updatedAt`. `status: "draft" | "issued" | "paid" | "overdue"`. `invoiceNumber` is only set once the record is issued. There is no dedicated garbage-fee/meter-maintenance-fee field — every optional charge, fixed or one-off, lives in `otherCharges`. Firestore path: `properties/{propertyId}/billing/{roomId_billingMonth}` — the document ID is deterministic (`` `${roomId}_${billingMonth}` ``), which is what makes "one bill per room per month" a Firestore-enforced invariant rather than something only the UI checks.
- **BillingCharge** — `id, masterId?, name, amount`. `masterId` links back to an `OtherChargeMaster` row when the charge was added from the master list; it's absent for a one-time custom charge typed directly on a bill. `name`/`amount` are a snapshot at the time the charge was added to this specific bill — editing them here never changes the master record, and vice versa.
- **OtherChargeMaster** (`src/types/otherCharge.ts`) — `id, nameTh, nameEn?, defaultAmount, isActive, createdAt, updatedAt`. Reusable master data for _optional_ per-bill charges (garbage, meter maintenance, parking, internet, cleaning, etc.). Embedded as an array field (`otherChargeMasters`) on `properties/{propertyId}/settings/general` rather than its own subcollection (see `PropertySettings` below) — `id`/`createdAt`/`updatedAt` are client-generated (`crypto.randomUUID()`/`new Date().toISOString()`) since Firestore's `serverTimestamp()` sentinel cannot be used inside an array element. A user can also explicitly pick one from the Settings-managed list (the dropdown only offers masters not already on the bill), at which point its `defaultAmount` is copied into a new `BillingCharge` that can then be edited per bill without touching the master. See Business Rules below for when active masters are auto-added vs. left to manual pick.
- **MeterReading** — `previousMeter, currentMeter, usage, rate, amount` (shape shared by electricity and water).
- **PropertySettings** (`src/types/settings.ts`) — single record: property name/address/phone plus the three true monthly defaults (`defaultElectricityRate`, `defaultWaterRate`, `defaultInvoiceNote`) plus `otherChargeMasters?: OtherChargeMaster[]`, used to prefill new rooms and billing records. Fixed/optional fee amounts (garbage, meter maintenance, etc.) are **not** stored as their own fields — see `OtherChargeMaster` above. Firestore path: `properties/{propertyId}/settings/general` — a single document holding everything above; there is no separate top-level `properties/{propertyId}` document with its own name/address/phone fields (nothing reads one).

**Important relations:** there is no separate `Invoice` entity. The Invoices page is a filtered/formatted view over `BillingRecord` (only records with `invoiceNumber` set, i.e. not `draft`) — this was a deliberate decision, reconfirmed during the Firebase migration (see Firebase Migration below), to avoid two sources of truth for the same data, since the original spec's "Monthly Billing Table" and "Invoice Management" sections share almost all their columns. There is likewise no `invoices` or `counters` collection in Firestore.

# Business Rules

- **Assignment exclusivity:** `assignmentRepository.assign()` runs inside a Firestore `runTransaction()`: it checks (via query, read inside the transaction) that neither the target room nor the target tenant already has an active assignment, then creates the new assignment document and sets `Room.status = "occupied"` in the same transaction. Only one active assignment per room (and per tenant) at a time. The transaction also writes a no-op `updatedAt` touch on the tenant document purely so Firestore's optimistic-concurrency check serializes two simultaneous `assign()` calls for the same tenant — without it, both transactions could read "no active assignment" before either commits.
- **Ending a tenancy:** `assignmentRepository.endByRoomId()` (also transactional) sets the assignment to `ended` and sets `Room.status = "available"` — but only if the room's current status is `occupied` (an explicit `maintenance`/`inactive` status is left alone, since ending occupancy shouldn't silently clear a maintenance flag).
- **Moving a tenant to a different room:** the Tenants page's assign flow checks for an existing active assignment for that tenant before assigning the new one, and ends the old one first if the room differs (`TenantsPage.tsx`).
- **Meter usage:** `usage = Math.max(0, currentMeter - previousMeter)` (`src/lib/calculations.ts`) — never negative.
- **Billing totals:** `subtotal = electricity.amount + water.amount + rentAmount`; `total = subtotal + sum(otherCharges.amount)` (`calculateBillingTotals` in `src/lib/calculations.ts`). There are no separate fixed-fee fields in the total — every optional charge, whether master-derived or custom, is just an `otherCharges` entry.
- **Invoice numbering:** `INV-{YYYY}-{MM}-{seq3}`, where `seq` is one more than the highest existing sequence number among records sharing that year+month (`generateInvoiceNumber` in `src/lib/invoice.ts`, unchanged pure function). There is no separate counter document in Firestore — `billingRepository.update()` computes the number inside a `runTransaction()` by querying existing `billing` documents for that month at the moment of issuance, so it stays correct even after deletions, and two admins issuing at the same instant can't compute the same number (Firestore retries the loser of the race, which re-reads and sees the winner's already-committed number).
- **Billing status lifecycle:** stored `status` changes only via explicit user actions — "Issue" (`draft -> issued`, assigns `invoiceNumber`) and "Mark as Paid" (`-> paid`). `overdue` is never written to storage; `resolveBillingStatus()` in `src/lib/invoice.ts` computes it at read-time (bumps `issued` to `overdue` when `dueDate` has passed) purely for display.
- **Due date default:** a new (non-edit) bill's `dueDate` defaults to the 15th of the month _after_ the prefilled `billingMonth` (`defaultDueDate()` in `src/lib/date.ts`) — e.g. a bill defaulting to billing month 2026-08 defaults its due date to 2026-09-15. This is a one-time initial default only; it does not live-recompute if the user changes `billingMonth` or `dueDate` afterward, and editing an existing `BillingRecord` always loads its saved `dueDate` untouched.
- **Other charges default from Settings:** `BillingFormDialog.buildFormState()` only auto-prefills `otherCharges` in the _create_ path (no `record` passed in) — it maps every active `OtherChargeMaster` (`isActive: true`) into a `ChargeRow` snapshotting the master's current `defaultAmount`/localized name, so a new bill opens with all currently-active masters already attached instead of empty. The user can still remove any of them (they reappear in the "add charge" dropdown) or add a one-off custom charge. Changing the selected room on a still-new bill re-derives this default list the same way (alongside the existing rent/rate prefill reset), so it always reflects the _current_ Settings state at the moment of selection. Editing an existing `BillingRecord` never re-derives from Settings — it loads the bill's already-saved `otherCharges` snapshot untouched, so later master edits/deactivations don't retroactively change past bills.
- **Grouped Electricity/Water header:** `BillingTable`'s desktop table header is two `<TableRow>`s inside one `<TableHeader>`, not one flat row — row 1 has a `colSpan={5}` "ไฟฟ้า"/`billing.electricityGroup` cell and a `colSpan={5}` "น้ำ"/`billing.waterGroup` cell (each spanning that utility's previous/current/usage/rate/amount columns), while every other column (checkbox, room, tenant, invoice #, month, rent, total, status, actions) is `rowSpan={2}` on row 1 so it isn't duplicated in row 2. Row 2 holds only the 10 sub-headers, reusing one shared set of labels (`billing.meterPrev/meterCur/meterUsage/meterRate/meterAmount`) for both groups instead of the old prefixed `elecPrev`/`waterPrev`-style keys, since the group header already disambiguates electricity vs. water. month and year are two independent `Select`s, not one combined billing-month dropdown. Month is a fixed `"01"`..`"12"` list labeled via `monthName()` (`src/lib/date.ts`); year options are derived from the data itself — `Array.from(new Set(records.map(r => r.billingMonth.slice(0,4))))`, sorted desc, labeled via `yearLabel()` (renders the Buddhist-era year for Thai, matching every other date display) — so the year list is never a dead end with no matching records. Filtering compares each half of `record.billingMonth.split("-")` independently, so "all months" + a specific year (or vice versa) both work. Independent of the payment-status filter — all three apply together (AND).
- **Billing status filter:** `BillingPage`'s status dropdown (all/draft/issued/paid/overdue) filters on `resolveBillingStatus(record)`, not the raw stored `status` — so a stored `issued` record past its `dueDate` shows up under "overdue" in the filter, matching what `StatusBadge` already displays for that row.
- **Bulk issue:** `BillingTable`'s row checkboxes are enabled only for `status === "draft"` records (issuing is the only bulk action, so nothing else is selectable, and the checkboxes/bulk button are hidden entirely for a `staff` user — see Authentication). `BillingPage` keeps the raw selection in a `Set<string>` and intersects it against currently-draft record ids on every render (`effectiveSelectedIds`) so a row individually issued via its own row action, or no longer matching the active status filter's draft set, silently drops out of the selection instead of leaving a stale checked-but-disabled row. "Issue Selected" `await`s `updateBilling(id, { status: "issued" })` once per selected id in a **sequential `for...of` loop, never `Promise.all`** — each issuance's transaction must commit before the next one's transaction reads "existing records for this month," or two issuances could both read the pre-issuance state and unnecessarily contend/retry against each other rather than each cleanly succeeding in turn. Stops at the first failure rather than continuing past it, and only clears the ids that actually succeeded from the selection.
- **Room status behavior:** new rooms default to `status: "available"` unless specified; occupancy is otherwise only changed by the assignment flow above.
- **Validation** (`src/lib/validation.ts`): room number required, monthly rent / rates ≥ 0; tenant first/last name required; billing current meter ≥ previous meter (both utilities), rent ≥ 0.
- **Delete behavior:** every delete (room/tenant/billing) goes through `ConfirmDialog` (a Radix `AlertDialog` wrapper), never `window.confirm`. Every mutation shows a `sonner` toast.

# Feature Status

| Feature                       | Status | Notes                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication (Login/Logout) | Done   | Firebase Authentication + a Firestore `users/{uid}` profile via `AuthProvider`/`useAuth()`, no backend; gates the whole app through `ProtectedApp` — see Authentication above                                                                                                                |
| Role-gated write UI            | Done   | `admin` sees create/edit/delete/issue/mark-paid affordances everywhere; `staff` sees none — UX only, Firestore Security Rules are the real enforcement — see Authentication above                                                                                                            |
| Session Persistence           | Done   | Handled entirely by the Firebase Auth SDK's own persistence; `onAuthStateChanged` restores the session on load, survives refresh                                                                                                                                                              |
| Theme System                  | Done   | Appearance (light/dark/system) + 4 accent themes via `useTheme()`; persisted, applies instantly, no flash on load — see Theme Architecture above                                                                                                                                              |
| Dark Mode                     | Done   | Deep slate/navy neutrals (not pure black); all 4 accent themes have tuned dark variants                                                                                                                                                                                                       |
| Dashboard                     | Done   | Summary cards (theme-driven fills), room status overview, recent billing, quick actions                                                                                                                                                                                                       |
| Rooms                         | Done   | CRUD, detail sheet with billing history, assign/end tenancy, client-side search                                                                                                                                                                                                               |
| Tenants                       | Done   | CRUD, detail sheet, assign/move room, client-side search                                                                                                                                                                                                                                      |
| Assignments                   | Done   | Exclusive active assignment per room, move-room handling                                                                                                                                                                                                                                      |
| Billing                       | Done   | Auto-calculated usage/totals, other charges, desktop table + mobile cards, client-side search, payment-status filter (draft/issued/paid/overdue via `resolveBillingStatus`), billing-month filter, checkbox row selection + bulk "Issue Selected" (draft records only), frozen Actions column |
| Invoices                      | Done   | List, in-app preview dialog, standalone print page, auto invoice numbering, client-side search, billing-month filter                                                                                                                                                                          |
| Print Invoice                 | Done   | `/invoices/:id` standalone route, `@media print` + `@page A4`, browser print/Save-as-PDF                                                                                                                                                                                                      |
| Settings                      | Done   | Property info + the 3 true billing defaults (electricity rate, water rate, invoice note), plus a separate Other Charge Master (optional per-bill charges); used by new rooms and billing — see Data Migration History                                                                         |
| Responsive                    | Done   | Verified at 375/768/1024/1440px via headless Chrome screenshots; sidebar becomes a Sheet drawer under `md`, billing table becomes cards under `md`                                                                                                                                            |
| Localization (Thai/English)   | Done   | Every user-facing string routed through `t()`; verified live in-browser for both languages, including the bilingual invoice document, `{{param}}` interpolation, and `localStorage` persistence                                                                                               |

# Storage Keys

There are no domain-data `localStorage` keys anymore — every business collection lives in Firestore (see Firebase Migration below). The old `rental.*`-prefixed keys (`rental.rooms`, `rental.tenants`, `rental.assignments`, `rental.billing`, `rental.settings`, `rental.otherCharges`) and the auth session key (`rental.auth.session`) no longer exist; `src/data/storage/storage.ts` (the generic `localStorage` helper that wrote them) was deleted once nothing referenced it.

The only remaining `localStorage` keys are UI preferences, unprefixed (never `rental.`, since they are not property data):

- `app.language` (see Localization Architecture) — `"th"` or `"en"`.
- `app.appearance` (see Theme Architecture) — `"light" | "dark" | "system"`.
- `app.accentTheme` (see Theme Architecture) — `"sky-purple" | "ocean" | "emerald" | "rose"`.

The Firestore schema that replaced the domain keys above — `users/{uid}`, `properties/{propertyId}/{rooms,tenants,assignments,billing,settings/general}` — is documented in [docs/firebase/data-model.md](docs/firebase/data-model.md) and in Firebase Migration below.

# Data Migration History

**2026-08-10 — Fixed-fee-to-master-data migration.** `PropertySettings` used to carry `defaultGarbageFee`/`defaultElectricityMeterMaintenanceFee`/`defaultWaterMeterMaintenanceFee`, and `BillingRecord` mirrored them as dedicated scalar fields (`garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee`), auto-applied to every new bill. These were replaced by `OtherChargeMaster` (optional, explicitly attached per bill) and folded into `BillingRecord.otherCharges`. `src/data/migrations/legacyChargeMigration.ts`, called unconditionally from `main.tsx` (not nested inside `seedIfEmpty()`, since that only runs on a truly empty install), performs a one-time idempotent migration: seeds 7 example `OtherChargeMaster` rows (using any pre-existing legacy settings values where present), converts any pre-existing `BillingRecord`'s nonzero legacy fee fields into `otherCharges` entries linked back to the matching seeded master by name, and strips the legacy fields from both collections. Safe to re-run — once the legacy fields are gone from a record, there's nothing left to migrate.

# Firebase Migration

**Status: Complete.** The app authenticates and reads/writes exclusively through Firebase Authentication and Cloud Firestore, with no backend of any kind. This superseded an earlier, fully-built Cloud Functions/Express REST API (which itself had superseded the original `localStorage`-only design) — that backend, and the REST client that would have consumed it, were deleted outright as part of this migration rather than kept around unused; see "What got deleted" below. If you find references to `functions/`, `src/api/`, `propertySettings/{propertyId}` as a top-level collection, `roomAssignments`, `billingRecords`, `invoices`, or `counters` collections anywhere outside this file's own history, they describe that deleted intermediate design, not the current app.

**Architecture:** `AuthContext` subscribes to `onAuthStateChanged()` and loads the signed-in user's profile from `users/{uid}` in Firestore directly (see Authentication above). Every business repository (`rooms`, `tenants`, `assignments`, `billing`, `settings`, `otherCharges`) is `onSnapshot`-driven for reads and uses `runTransaction()` for the three write paths that need multi-document atomicity (assignment create/end, room-status coordination, invoice-number issuance) — see Repository architecture above. [firestore.rules](firestore.rules) is the only authorization boundary; role and property-membership checks that used to live in Express middleware now live entirely in that one file. The full schema is in [docs/firebase/data-model.md](docs/firebase/data-model.md); Firebase project setup and the Emulator Suite are in [docs/firebase/setup.md](docs/firebase/setup.md).

**Decisions made during this migration** (recorded here since they're not obvious from the code alone):

- **No separate `invoices`/`counters` collections.** The intermediate Cloud Functions backend had introduced an immutable `invoices` collection plus a server-side sequence counter. That was reverted back to the original design this file has always documented under "Important relations" above: `billing` is the single source of truth, and a record becomes "issued" via a transaction that assigns `invoiceNumber` by scanning existing `billing` documents for that property+month — the same logic as `generateInvoiceNumber()` always had, just run inside a Firestore transaction instead of a synchronous array scan (or, in the deleted backend's case, an Admin SDK transaction).
- **Other Charge Masters are embedded, not a subcollection.** `otherChargeMasters` lives as an array field directly on `properties/{propertyId}/settings/general`, not its own `properties/{propertyId}/otherCharges/{chargeId}` collection. One document, one `onSnapshot`, no extra security-rule block — see Domain Model above.
- **Bootstrapping the first admin user is manual, by design, forever (not just "until a script exists").** There is no sign-up flow and, since there's no backend, no code path that can safely create a `users/{uid}` document — Firestore rules deliberately forbid a user from writing their own profile/role, or anyone could self-grant `admin`. The very first property + admin profile is created by hand via the Firebase Console (or the Emulator UI for local dev) — see the README's [First-Time Setup](README.md#first-time-setup). No `firebase-admin` dependency, no seed script.
- **Hooks gained an `isLoading` flag; this is the one UI-shape change beyond what going async structurally forced.** `onSnapshot()`'s first snapshot arrives after a round trip even against the emulator; without a loading flag, every page would flash its "no records yet" empty state before real data arrives. Every hook adds `isLoading: boolean` (additive — nothing existing was renamed/removed); every page gates its render with one `if (isLoading) return <PageSpinner />;` line.

**What got deleted:** the entire `functions/` tree (Express app, routes, controllers, services, repositories, middleware, validators, error codes, its own `package.json`); `src/api/client.ts` and `src/api/errors.ts`; `src/lib/firebase/functions.ts` and the `functions` export from the `@/lib/firebase` barrel; `src/data/storage/storage.ts` (the generic `localStorage` CRUD helper, once every repository had moved to Firestore and nothing imported it anymore); `src/data/seed/seedData.ts` and `src/data/migrations/*` (no demo seeding against a shared Firestore project, and no legacy data to migrate — the manual bootstrap above replaces both); `docs/firebase/{backend,api,authentication}.md` (described the deleted backend in detail) and `docs/adr/0003-cors-fail-closed-outside-emulator.md` (no server, no CORS, decision no longer applies); the `VITE_API_BASE_URL`/`VITE_FIREBASE_FUNCTIONS_REGION` env vars.

**What's new/changed on the frontend, beyond the repository rewrite itself:** `RoomTenantAssignment` gained `updatedAt` (see Domain Model above — needed so the assign/end transactions have a field to "touch" on the tenant document to serialize concurrent assignment attempts); every page/table that renders a create/edit/delete/issue/mark-paid button now checks `useAuth().user?.role === "admin"` inline before rendering it (see Authentication above); the `Tenant.fullName`/`.name` field-name mismatch that had crept back in via a bad merge was fixed before any of the above started, so `pnpm build`'s `tsc -b` pass was clean throughout.

**Known, accepted limitation — no server-enforced cross-document invariants:** Firestore Security Rules are the only thing stopping a malicious *admin*-role account from bypassing a transaction's invariant checks by calling the raw SDK directly (e.g. writing two "active" assignments for one room via `setDoc` instead of `assignmentRepository.assign()`). The rules catch property/role boundary violations but cannot cheaply inspect sibling documents to catch every cross-document business rule a transactional backend would have enforced. This is a deliberate trade-off of removing the backend per the migration's own spec, not an oversight — see [docs/firebase/data-model.md](docs/firebase/data-model.md)'s "Known limitation" section for the full reasoning.

# Important Files

| Path                                                                                                 | Responsibility                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/router.tsx`                                                                                  | Route table                                                                                                                                                                          |
| `src/app/AppLayout.tsx`                                                                               | Sidebar + header shell, `<Outlet/>`, toaster mount                                                                                                                                    |
| `firestore.rules`                                                                                     | The sole authorization boundary — property/role scoping, `users/{uid}` never client-writable, billing immutability-after-issuance check                                              |
| `firestore.indexes.json`                                                                              | The two composite indexes the assignment transactions need                                                                                                                            |
| `src/lib/firebase/{app,auth,firestore,config,emulators,index}.ts`                                     | Firebase App/Auth/Firestore client boundary, env validation, and development-only Emulator Suite wiring — the only place `firebase/*` is imported outside `src/auth/*`               |
| `src/lib/activeProperty.ts`                                                                           | `getActivePropertyId(propertyIds)` — resolves the single-property UI's active property; every repository call site derives `propertyId` from here, never internally                  |
| `src/data/repositories/converters/timestamp.ts`                                                       | `timestampToIso`/`isoToTimestamp` — the one place Firestore `Timestamp` meets the app's ISO-string domain types                                                                       |
| `src/data/repositories/firestoreCrud.ts`                                                              | Generic single-subcollection CRUD factory (`getAll`/`subscribe`/`create`/`update`/`delete`), reused by rooms and tenants                                                             |
| `src/data/repositories/{room,tenant,assignment,billing,settings,otherCharge}Repository.ts`             | Per-entity Firestore repositories — see Repository architecture above for which use the generic factory vs. hand-written transactions                                                |
| `docs/firebase/data-model.md`                                                                         | The actual final Firestore schema, business rules, and known limitations                                                                                                             |
| `docs/firebase/setup.md`                                                                              | Firebase Console setup, `.env.local`, and Emulator Suite instructions                                                                                                                 |
| `docs/firebase/emulator-troubleshooting.md`                                                           | macOS-specific Java/emulator troubleshooting (Thai)                                                                                                                                   |
| `docs/adr/0001-billing-rounding-rule.md`, `0002-invoice-paid-at-client-suppliable.md`, `0004-billing-record-deterministic-id.md` | Still-applicable architecture decisions carried over from the deleted backend (rounding rule, client-suppliable `paidAt`, deterministic billing doc ID) |
| `src/types/otherCharge.ts`                                                                            | `OtherChargeMaster` type + create/update input types                                                                                                                                  |
| `src/hooks/useOtherCharges.ts`                                                                        | Derives `otherCharges` from `useSettings()`'s snapshot (`settings.otherChargeMasters`) — no `onSnapshot` of its own                                                                    |
| `src/features/settings/OtherChargeSection.tsx`, `OtherChargeTable.tsx`, `OtherChargeFormDialog.tsx`   | Other Charge Master management UI on the Settings page; the section's "Add" button and the table's row actions are `admin`-only                                                       |
| `src/hooks/use*.ts`                                                                                   | Thin `onSnapshot`-driven reactive wrappers around repositories, each returning `isLoading`, consumed by feature pages                                                                 |
| `src/lib/calculations.ts`                                                                             | Meter usage / billing total math                                                                                                                                                     |
| `src/lib/invoice.ts`                                                                                  | Invoice number generation, display-time status resolution — unchanged pure functions, reused unchanged inside `billingRepository`'s transactions                                     |
| `src/lib/validation.ts`                                                                               | Form validators returning field-keyed error messages                                                                                                                                  |
| `src/lib/currency.ts`, `src/lib/date.ts`                                                              | Language-aware THB currency formatting, Thai/English date formatting                                                                                                                  |
| `src/lib/search.ts`                                                                                   | `matchesSearch()` — shared case-insensitive substring matcher used by every list page's search filter                                                                                 |
| `src/components/common/SearchInput.tsx`                                                               | Shared search box (shadcn `Input` + `Search` icon) used identically on Rooms/Tenants/Billing/Invoices                                                                                 |
| `src/components/common/PageSpinner.tsx`                                                               | Shared in-page loading placeholder shown while a hook's first `onSnapshot` callback hasn't fired yet                                                                                  |
| `src/components/common/LanguageSwitch.tsx`                                                            | Shared ไทย/EN toggle, used in both `AppHeader` and `LoginPage`                                                                                                                        |
| `src/auth/auth.types.ts`                                                                              | `AuthUser` (`id, name, email, role, propertyIds`), `AuthRole`, the swappable `AuthProvider` interface, `InvalidCredentialsError`                                                       |
| `src/auth/auth.service.ts`                                                                            | `FirebaseAuthService` — Firebase `signInWithEmailAndPassword`/`signOut`; `fetchUserProfile(uid)` reads `users/{uid}` from Firestore directly, no backend call                          |
| `src/auth/AuthContext.tsx`                                                                            | `AuthProvider` (React context) + `useAuth()` — session restore/update via `onAuthStateChanged`, `login`/`logout`                                                                      |
| `src/components/auth/ProtectedApp.tsx`                                                                | Top-level auth gate: loading screen / `LoginPage` / the real app                                                                                                                       |
| `src/features/auth/LoginPage.tsx`, `LoginForm.tsx`                                                    | Login UI — branding, form validation, password visibility toggle, real Firebase network-error handling                                                                                |
| `src/features/{rooms,tenants,billing,settings}/*Page.tsx`, `*Table.tsx`, `OtherChargeTable.tsx`, `src/features/invoices/{InvoicesPage,InvoicePreviewDialog}.tsx` | Where the inline `user?.role === "admin"` write-affordance gates live — see Authentication above; one check per button/row-action, no shared abstraction |
| `src/theme/theme.types.ts`                                                                            | `Appearance`/`AccentTheme` unions, defaults, `accentThemeTranslationKey()`                                                                                                             |
| `src/theme/theme.storage.ts`                                                                          | `app.appearance`/`app.accentTheme` read/write, corrupted-value-safe                                                                                                                    |
| `src/theme/ThemeContext.tsx`                                                                          | `ThemeProvider` (React context) + `useTheme()` — resolves `"system"`, applies `.dark`/`data-theme` to `<html>`                                                                        |
| `src/components/common/ThemeMenu.tsx`                                                                 | Compact appearance + accent quick-picker, shared by `AppHeader` and `LoginPage`                                                                                                       |
| `src/components/common/ThemeAccentSwatches.tsx`                                                       | Renders any theme's 5 chart-color dots via a locally-scoped `data-theme` override                                                                                                     |
| `index.html`                                                                                          | Inline anti-flash script — applies persisted theme before React mounts                                                                                                                |
| `src/i18n/types.ts`                                                                                   | `Language` union, the `Translations` interface (single source of truth for every key)                                                                                                 |
| `src/i18n/index.ts`                                                                                   | `LanguageProvider`, `useLanguage()`, `t()` lookup + `{{param}}` interpolation, dictionary registry                                                                                     |
| `src/i18n/translations/{en,th}.ts`                                                                    | The two language dictionaries, each typed `: Translations`                                                                                                                            |
| `src/features/invoices/InvoicePrintView.tsx`                                                          | The invoice document markup (bilingual via `t()`), shared by the preview dialog and the print page                                                                                    |
| `src/features/invoices/InvoicePrintPage.tsx`                                                          | Standalone `/invoices/:id` route (no `AppLayout`, but still inside `LanguageProvider`)                                                                                                 |
| `src/components/ui/*`                                                                                 | Hand-authored Radix-based primitives (see shadcn/ui note above)                                                                                                                        |
| `src/components/ui/checkbox.tsx`                                                                      | Hand-authored Radix `Checkbox` primitive; used for `BillingTable`'s row/select-all bulk-issue checkboxes                                                                               |

# Known Limitations

- **No server-enforced cross-document invariants** — with no backend, Firestore Security Rules are the only thing stopping a malicious *admin*-role account from bypassing a transaction's invariant checks by calling the raw SDK directly. See Firebase Migration above for the full reasoning; this is an accepted architectural trade-off, not an oversight.
- Single property only in the current UI — the schema already supports multiple properties per user (`users/{uid}.propertyIds` is an array), but there is no property switcher; the app always uses `propertyIds[0]`.
- No real PDF generation service — invoice "export" is the browser's native print / Save-as-PDF.
- No automated recurring monthly billing generation.
- No notifications (email/SMS/push).
- Only two languages ship (Thai, English); adding more is low-effort by design (see Localization Architecture) but not yet done.
- No audit trail of which admin performed a mutation (no `createdBy`/`updatedBy` on any document) and no rate limiting — both were properties of the deleted backend that have no client-only equivalent.
- No automated test suite of any kind (no `vitest`/`jest`, no `test` script). Verification is `pnpm build` (typecheck + production build), `pnpm lint`, and manual smoke testing against the Firebase Emulator Suite.

# Future Improvements

- Multi-property support in the UI (a property switcher; the schema already scopes by `propertyId` and a user's `propertyIds` array already supports more than one)
- Firebase Storage for any uploaded documents/photos
- An audit trail (`createdBy`/`updatedBy`) if that becomes a real requirement — would need either a trusted write path (a backend again) or a rule that can verify the claimed author matches `request.auth.uid`, which is straightforward to add to `firestore.rules` if needed
- An automated test suite, if one gets introduced — this plan's manual smoke-test steps (see each phase's own report under `.superpowers/sdd/2026-08-11-firebase-direct-firestore-migration/`) are a ready-made source for the first batch of integration tests

# Development Guidelines

- Read this file before modifying the project.
- Preserve TypeScript strict mode; do not introduce `any`.
- Keep business/billing calculations in `src/lib/*`, never inline in components.
- Keep all Firestore access behind `src/data/repositories/*` — components and hooks must not import `firebase/*` or call Firestore APIs directly. `localStorage` is reserved for the three UI-preference keys (`app.language`, `app.appearance`, `app.accentTheme`); no domain data goes there.
- Never hardcode user-facing strings in components — add a key to `Translations` (`src/i18n/types.ts`) and both dictionaries, then call `t("...")`. Never write `language === "th" ? ... : ...` inline.
- Keep `src/lib/validation.ts` free of any `src/i18n/` import — validators return translation keys, not literal messages; the calling component translates.
- Update this file after any meaningful architecture or feature change.
- Do not replace the repository/hook architecture (or the no-separate-Invoice-model decision) without documenting why here first.
- If re-introducing the `shadcn` CLI, verify generated files actually land in `src/components/ui/` before trusting its output (see the shadcn/ui note above).
