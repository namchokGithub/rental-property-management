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

# Search

Every list page (Rooms, Tenants, Billing, Invoices) has a client-side search box between the `PageHeader` and the data table, filtering the already-loaded array in `useMemo` — there is no search API and no state-management library involved.

- `src/components/common/SearchInput.tsx` — the shared input (shadcn `Input` + `lucide-react` `Search` icon positioned absolutely inside), used identically on all four pages so the search UI is visually consistent.
- `src/lib/search.ts` — `matchesSearch(query, ...fields)`, a small case-insensitive substring matcher shared by every page's filter `useMemo`. An empty query always matches (so the unfiltered list shows by default).
- Each page decides its own searchable fields: Rooms (`roomNumber`, `floor`, `type`, current tenant name), Tenants (`firstName`, `lastName`, `phone`, current room number), Billing (room number, tenant name, `invoiceNumber`, `billingMonth` raw + formatted), Invoices (`invoiceNumber`, room number, tenant name, formatted billing month).
- Search state (`searchQuery`) is local `useState` in the page component, matching the rest of the app's "no global state" strategy (see State strategy above).
- Zero-records (nothing created yet) and zero-search-results (records exist, none match) render as two distinct `EmptyState`s — the former keeps its "create the first one" call-to-action, the latter shows a `Search`-icon empty state with a "clear search" action that resets `searchQuery`.

**Deliberately not searchable:** the Dashboard's "recent billing" table (a top-5 preview, not a full list — search belongs on the Billing page it links to) and the per-room/per-tenant billing history shown inside `RoomDetailSheet`/`TenantDetailSheet` (scoped to a single entity, typically a handful of rows). The Settings page has no list data.

**Language switch UI:** two `Button`s in `AppHeader` ("ไทย" / "EN"), the active one rendered with `variant="default"` and the inactive with `variant="ghost"`. Switching calls `setLanguage()` — no page reload, every mounted component re-renders instantly because they all read `language`/`t` from the same context.

**How to add a new language (e.g. `ja`):**
1. Add `"ja"` to the `Language` union in `src/i18n/types.ts`.
2. Create `src/i18n/translations/ja.ts` exporting a default object typed `: Translations` — TypeScript will list every missing key as a compile error, so it's impossible to ship an incomplete dictionary.
3. Register it in the `DICTIONARIES` map in `src/i18n/index.ts` (`{ en, th, ja }`).
4. Add a third button (or switch to a `Select`/`DropdownMenu`) in `AppHeader`'s language switch.

No component outside those four spots needs to change — every feature file only ever calls `t("some.key")`, never references a language literal directly (aside from the switch buttons themselves).

# Domain Model

- **Room** (`src/types/room.ts`) — `id, roomNumber, floor?, type?, monthlyRent, status, description?, electricityRate, waterRate, createdAt, updatedAt`. `status: "available" | "occupied" | "maintenance" | "inactive"`. Never stores a tenant reference.
- **Tenant** (`src/types/tenant.ts`) — `id, firstName, lastName, phone?, email?, identificationNumber?, address?, emergencyContactName?, emergencyContactPhone?, status, notes?, createdAt, updatedAt`. `status: "active" | "inactive"`.
- **RoomTenantAssignment** (`src/types/assignment.ts`) — `id, roomId, tenantId, startDate, endDate?, status, createdAt`. `status: "active" | "ended"`. This is the **only** source of truth for which tenant occupies which room — resolve "current tenant for room X" via `assignmentRepository.getActiveByRoomId(roomId)`, never via a field on `Room`.
- **BillingRecord** (`src/types/billing.ts`) — `id, roomId, tenantId?, invoiceNumber?, billingMonth ("YYYY-MM"), electricity: MeterReading, water: MeterReading, rentAmount, garbageFee, electricityMeterMaintenanceFee, waterMeterMaintenanceFee, otherCharges: BillingCharge[], subtotal, total, status, issuedAt?, dueDate?, paidAt?, createdAt, updatedAt`. `status: "draft" | "issued" | "paid" | "overdue"`. `invoiceNumber` is only set once the record is issued.
- **BillingCharge** — `id, name, amount` (ad-hoc "other charges" line items on a `BillingRecord`).
- **MeterReading** — `previousMeter, currentMeter, usage, rate, amount` (shape shared by electricity and water).
- **PropertySettings** (`src/types/settings.ts`) — single record: property name/address/phone plus default electricity/water rates and default fixed fees, used to prefill new rooms and billing records.

**Important relations:** there is no separate `Invoice` entity. The Invoices page is a filtered/formatted view over `BillingRecord` (only records with `invoiceNumber` set, i.e. not `draft`) — this was a deliberate decision to avoid two sources of truth for the same data, since the original spec's "Monthly Billing Table" and "Invoice Management" sections share almost all their columns.

# Business Rules

- **Assignment exclusivity:** `assignmentRepository.assign()` ends any existing active assignment for that room before creating the new one, then sets `Room.status = "occupied"`. Only one active assignment per room at a time.
- **Ending a tenancy:** `assignmentRepository.endByRoomId()` sets the assignment to `ended` and sets `Room.status = "available"` — but only if the room's current status is `occupied` (an explicit `maintenance`/`inactive` status is left alone, since ending occupancy shouldn't silently clear a maintenance flag).
- **Moving a tenant to a different room:** the Tenants page's assign flow checks for an existing active assignment for that tenant before assigning the new one, and ends the old one first if the room differs (`TenantsPage.tsx`).
- **Meter usage:** `usage = Math.max(0, currentMeter - previousMeter)` (`src/lib/calculations.ts`) — never negative.
- **Billing totals:** `subtotal = electricity.amount + water.amount + rentAmount + garbageFee + electricityMeterMaintenanceFee + waterMeterMaintenanceFee`; `total = subtotal + sum(otherCharges.amount)` (`calculateBillingTotals` in `src/lib/calculations.ts`).
- **Invoice numbering:** `INV-{YYYY}-{MM}-{seq3}`, where `seq` is one more than the highest existing sequence number among records sharing that year+month (`generateInvoiceNumber` in `src/lib/invoice.ts`). There is no separate counter in storage — the number is derived from existing records every time, so it stays correct even after seeding or deletions.
- **Billing status lifecycle:** stored `status` changes only via explicit user actions — "Issue" (`draft -> issued`, assigns `invoiceNumber`) and "Mark as Paid" (`-> paid`). `overdue` is never written to storage; `resolveBillingStatus()` in `src/lib/invoice.ts` computes it at read-time (bumps `issued` to `overdue` when `dueDate` has passed) purely for display.
- **Room status behavior:** new rooms default to `status: "available"` unless specified; occupancy is otherwise only changed by the assignment flow above.
- **Validation** (`src/lib/validation.ts`): room number required, monthly rent / rates ≥ 0; tenant first/last name required; billing current meter ≥ previous meter (both utilities), rent ≥ 0.
- **Delete behavior:** every delete (room/tenant/billing) goes through `ConfirmDialog` (a Radix `AlertDialog` wrapper), never `window.confirm`. Every mutation shows a `sonner` toast.

# Feature Status

| Feature | Status | Notes |
|---|---|---|
| Dashboard | Done | Summary cards, room status overview, recent billing, quick actions |
| Rooms | Done | CRUD, detail sheet with billing history, assign/end tenancy, client-side search |
| Tenants | Done | CRUD, detail sheet, assign/move room, client-side search |
| Assignments | Done | Exclusive active assignment per room, move-room handling |
| Billing | Done | Auto-calculated usage/totals, other charges, desktop table + mobile cards, client-side search |
| Invoices | Done | List, in-app preview dialog, standalone print page, auto invoice numbering, client-side search |
| Print Invoice | Done | `/invoices/:id` standalone route, `@media print` + `@page A4`, browser print/Save-as-PDF |
| Settings | Done | Property info + default rates, used by new rooms and billing |
| Responsive | Done | Verified at 375/768/1024/1440px via headless Chrome screenshots; sidebar becomes a Sheet drawer under `md`, billing table becomes cards under `md` |
| Localization (Thai/English) | Done | Every user-facing string routed through `t()`; verified live in-browser for both languages, including the bilingual invoice document, `{{param}}` interpolation, and `localStorage` persistence |

# Storage Keys

All defined in `src/data/storage/storage.ts` (`STORAGE_KEYS`), stored under the `rental.` prefix:

- `rental.rooms`
- `rental.tenants`
- `rental.assignments`
- `rental.billing`
- `rental.settings`

Plus one non-domain key: `app.language` (see Localization Architecture), holding `"th"` or `"en"`.

# Important Files

| Path | Responsibility |
|---|---|
| `src/app/router.tsx` | Route table |
| `src/app/AppLayout.tsx` | Sidebar + header shell, `<Outlet/>`, toaster mount |
| `src/data/storage/storage.ts` | Generic localStorage read/write helpers |
| `src/data/repositories/*` | CRUD + domain logic per entity; the only code that touches `storage.ts` |
| `src/data/seed/seedData.ts` | One-time idempotent demo data seeding, called from `src/main.tsx` |
| `src/hooks/use*.ts` | Thin reactive wrappers around repositories, consumed by feature pages |
| `src/lib/calculations.ts` | Meter usage / billing total math |
| `src/lib/invoice.ts` | Invoice number generation, display-time status resolution |
| `src/lib/validation.ts` | Form validators returning field-keyed error messages |
| `src/lib/currency.ts`, `src/lib/date.ts` | Language-aware THB currency formatting, Thai/English date formatting |
| `src/lib/search.ts` | `matchesSearch()` — shared case-insensitive substring matcher used by every list page's search filter |
| `src/components/common/SearchInput.tsx` | Shared search box (shadcn `Input` + `Search` icon) used identically on Rooms/Tenants/Billing/Invoices |
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
