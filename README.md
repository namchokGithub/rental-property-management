# Rental Property Management

A responsive frontend web application for managing rental rooms, apartments, or dormitory rooms: rooms, tenants, tenant-room assignments, monthly utility/rent billing, invoice generation, and a dashboard overview.

The project runs entirely on the frontend using `localStorage`, with an architecture prepared for future migration to Firebase or a backend REST API without rewriting the UI.

## Requirements

- Node.js 20+
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

- **Dashboard** — occupancy summary cards, room status breakdown, recent billing, quick actions.
- **Rooms** — CRUD, status (available/occupied/maintenance/inactive), room detail with utility rates and billing history.
- **Tenants** — CRUD, contact/emergency/lease info, current room lookup.
- **Assignments** — assign a tenant to a room, end a tenancy, move a tenant to a different room. Only one active assignment per room at a time; room status updates automatically.
- **Monthly Billing** — enter electricity/water meter readings and fees; usage and totals are calculated automatically. Wide table with sticky Room/Tenant columns on desktop, card layout on mobile.
- **Invoices** — auto-numbered (`INV-YYYY-MM-###`) invoice list, in-app preview, and a standalone printable bilingual invoice document (browser print / Save as PDF, A4-optimized).
- **Settings** — property info and default billing rates, applied automatically to new rooms and billing records.
- **Search** — every list page (Rooms, Tenants, Billing, Invoices) has a client-side search box that filters the loaded records instantly; no backend or state-management library involved.
- **Localization** — switch between Thai and English instantly, anywhere in the app (see below).

## Tech Stack

- Vite + React + TypeScript (strict mode)
- Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`)
- Radix UI primitives (via the `radix-ui` package), styled in the shadcn/ui convention
- React Router
- lucide-react icons
- sonner (toast notifications)
- `localStorage` behind a repository abstraction (see [context.md](context.md))
- Custom lightweight i18n (no library) — see Localization below

## Project Structure

```
src/
  app/            # router, layout shell
  components/     # ui primitives, layout, shared common components
  data/           # storage, repositories, seed data
  features/       # one folder per page/feature
  hooks/          # thin hooks wrapping repositories
  lib/            # pure calculation/formatting/validation utilities
  types/          # domain models
```

See [context.md](context.md) for the full architecture, domain model, business rules, and continuation notes for future development.

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
4. Add a corresponding button/option to the language switch in `src/components/layout/AppHeader.tsx`.

No other component needs to change. See [context.md](context.md) for the full localization architecture.

## Demo Data Behavior

On first load (when `localStorage` has no rooms yet), the app seeds a small set of rooms, tenants, assignments, and billing records so every page has realistic content. Seeding is idempotent — it only runs once; clearing the relevant `localStorage` keys (see [context.md](context.md#storage-keys)) re-triggers it.

## Current Limitations

- Frontend only — no backend, no authentication, no real database.
- Single property only (no multi-property support).
- No real PDF generation service — invoice export relies on the browser's native print / "Save as PDF".
- No automated recurring billing generation or notifications.
