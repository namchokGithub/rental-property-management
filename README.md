# Rental Property Management

A responsive frontend web application for managing rental rooms, apartments, or dormitory rooms: rooms, tenants, tenant-room assignments, monthly utility/rent billing, invoice generation, and a dashboard overview.

The React app runs entirely on the frontend using `localStorage`; nothing below is wired to a backend yet. A separate, fully-implemented Firebase Cloud Functions backend already exists in `functions/` (Firestore + Firebase Authentication + a complete REST API, verified against the Emulator Suite) and is documented in `docs/firebase/` and [context.md](context.md#firebase-migration) — the frontend just hasn't been switched over to it.

## Requirements

- Node.js 20+ for the frontend (Node.js 22 for the Firebase Functions project)
- pnpm

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Opens the app at `http://localhost:5173`. Demo data is seeded automatically into `localStorage` on first load.

## Build

```bash
pnpm build
```

Type-checks with `tsc -b` and produces a production build in `dist/`.

## Lint

```bash
pnpm lint
```

## Main Features

- **Authentication** — demo login/logout gating the whole app, with a persistent session (see below).
- **Dashboard** — occupancy summary cards, room status breakdown, recent billing, quick actions.
- **Rooms** — CRUD, status (available/occupied/maintenance/inactive), room detail with utility rates and billing history.
- **Tenants** — CRUD, contact/emergency/lease info, current room lookup.
- **Assignments** — assign a tenant to a room, end a tenancy, move a tenant to a different room. Only one active assignment per room at a time; room status updates automatically.
- **Monthly Billing** — enter electricity/water meter readings and fees; usage and totals are calculated automatically. Wide table with sticky Room/Tenant columns on desktop, card layout on mobile.
- **Invoices** — auto-numbered (`INV-YYYY-MM-###`) invoice list, in-app preview, and a standalone printable bilingual invoice document (browser print / Save as PDF, A4-optimized).
- **Settings** — property information, the default electricity/water rates and invoice note, plus an optional Other Charge Master list (e.g. parking or garbage fees) that users explicitly add to individual bills.
- **Search** — every list page (Rooms, Tenants, Billing, Invoices) has a client-side search box that filters the loaded records instantly; no backend or state-management library involved.
- **Localization** — switch between Thai and English instantly, anywhere in the app (see below).
- **Appearance & themes** — light, dark, and system appearance modes with four persisted accent themes: Sky Purple, Ocean, Emerald, and Rose.

## Tech Stack

- Vite + React + TypeScript (strict mode)
- Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`)
- Radix UI primitives (via the `radix-ui` package), styled in the shadcn/ui convention
- React Router
- lucide-react icons
- sonner (toast notifications)
- `localStorage` behind a repository abstraction (see [context.md](context.md))
- Custom lightweight i18n (no library) — see Localization below
- Firebase client SDK and a separate Firebase Cloud Functions/Express API (implemented but not yet integrated with the UI)

## Project Structure

```
src/
  app/            # router, layout shell
  auth/           # demo authentication service and React auth context
  components/     # ui primitives, layout, shared common components
  data/           # storage, repositories, seed data, migrations
  features/       # one folder per page/feature
  hooks/          # thin hooks wrapping repositories
  i18n/           # typed Thai/English dictionaries and language context
  lib/            # pure calculation/formatting/validation utilities
  theme/          # appearance/accent theme context and persistence
  types/          # domain models
functions/        # Firebase Cloud Functions + Express REST API
docs/firebase/    # Firebase setup, backend, data-model, and API documentation
```

See [context.md](context.md) for the full architecture, domain model, business rules, and continuation notes for future development.

## Authentication

The app is gated behind a login screen. **This is frontend/demo authentication, not real security** — there is no backend, no password hashing, and no server verifying anything. Login runs entirely in the browser: a demo credential is compared in `src/auth/auth.service.ts`, and on success a user object (no password) is written to `localStorage` under `rental.auth.session`.

This is deliberately architected so it *can* become real: the UI only ever talks to an `AuthProvider` interface (`src/auth/auth.types.ts`) through `useAuth()` — swapping the demo `LocalAuthService` for a `FirebaseAuthService` later means changing one line in `auth.service.ts`, not the login page, the form, the route protection, or the header's account menu. See the "Authentication" section in [context.md](context.md) for the full architecture.

**Do not treat this as production-ready.** Before real deployment: replace it with Firebase Authentication (or a real backend), since anyone can read the demo credential from the frontend source or edit the `localStorage` session by hand.

### Demo Account

```
Email:    admin@email.com
Password: admin123
```

This credential is for local demo purposes only — it's a plaintext constant in the frontend source, not a real account.

## Localization

**Supported Languages**

- Thai (default)
- English

Switch languages instantly from the two buttons in the top header ("ไทย" / "EN") — no page reload. The choice is saved to `localStorage` (`app.language`) and restored on the next visit. Every screen, form, dialog, table, toast, and the printable invoice document itself are all fully translated; only property-owner-entered data (property name/address, invoice notes, room/tenant names) is left as-is, since that's real content rather than UI copy.

**How to add more languages**

The system was built to make this a translation-file-only change:

1. Add the new language code to the `Language` union in `src/i18n/types.ts`.
2. Add `src/i18n/translations/<code>.ts` exporting a dictionary typed `: Translations` — TypeScript will flag any missing key at compile time, so an incomplete translation can't ship.
3. Register the new dictionary in `src/i18n/index.ts`'s `DICTIONARIES` map.
4. Add a corresponding button/option to `src/components/common/LanguageSwitch.tsx` (shared by the header and the login page).

No other component needs to change. See [context.md](context.md) for the full localization architecture.

## Appearance and Accent Themes

Choose light, dark, or system appearance and one of four accent themes from the header menu. Both settings apply immediately and persist across visits using `app.appearance` and `app.accentTheme`. The saved theme is applied before React mounts to avoid a flash of the default theme.

## Demo Data Behavior

On first load (when `localStorage` has no rooms yet), the app seeds rooms, tenants, assignments, billing records, and example optional charge masters so every page has realistic content. Seeding is idempotent — it only runs once; clearing the relevant `localStorage` keys (see [context.md](context.md#storage-keys)) re-triggers it.

Existing installations are also safely migrated from the former fixed-fee fields to optional per-bill charges; the migration is idempotent and runs during app startup.

## Firebase Backend

The Firebase backend is complete through Phase 3, but frontend integration (Phase 4) has not started. It provides a versioned Cloud Functions/Express API at `/api/v1`, Firebase Authentication token verification, property-scoped Firestore data, transaction-safe assignments/billing/invoice actions, and documented emulator workflows.

```bash
pnpm --dir functions emulators --project demo-rental-property-management
```

See [Firebase setup](docs/firebase/setup.md), [backend architecture](docs/firebase/backend.md), and the [API reference](docs/firebase/api.md). The frontend still exclusively uses its local repositories and demo authentication until Phase 4.

## Current Limitations

- The React app itself is still frontend-only — no page calls the backend yet, and its own auth is demo-only (see Authentication above), not secure for production. A verified Firebase backend exists in `functions/` but is not yet integrated (Phase 4, not started).
- Single property only (no multi-property support).
- No real PDF generation service — invoice export relies on the browser's native print / "Save as PDF".
- No automated recurring billing generation or notifications.
