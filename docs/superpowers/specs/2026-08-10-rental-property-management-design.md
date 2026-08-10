# Rental Property Management — Design Spec

Date: 2026-08-10
Status: Approved

## 1. Overview

Frontend-only responsive admin web app for managing rental rooms/apartments/dormitory rooms: rooms, tenants, tenant-room assignments, monthly utility+rent billing, invoice generation/print, dashboard, settings. No backend. Data persists in `localStorage` behind a repository abstraction so it can be swapped for Firebase/REST later without touching UI/feature code.

Primary users: property owner/admin. Desktop-first, must work down to 375px mobile.

## 2. Tech Stack

- Vite + React + TypeScript (strict mode)
- Tailwind CSS v4 (CSS-first config via `@tailwindcss/vite`, no `tailwind.config.js`)
- shadcn/ui (Radix primitives) — init via CLI, add components on demand
- lucide-react icons
- sonner for toasts
- React Router v7 for page navigation
- No global state library. React Context only where genuinely cross-cutting (theme-less here — likely none needed beyond maybe a settings/toast context; prefer local state + custom hooks per repository)
- Package manager: pnpm

## 3. Architecture

### 3.1 Navigation

Restriction from requirements says "use React Router for page switching," which supersedes the illustrative `Page` union/`useState` example also given. Real routes, rendered inside a persistent `AppLayout` (sidebar + header) except for the standalone invoice view:

```
/                      -> redirect to /dashboard
/dashboard
/rooms
/tenants
/billing
/invoices
/invoices/:id          -> standalone, NO AppLayout (print target)
/settings
```

`AppLayout` renders `<Outlet />`. The `/invoices/:id` route is a sibling route without the layout wrapper — nothing to hide via CSS at print time because sidebar/header simply aren't mounted there.

### 3.2 Feature organization

Feature-based folders under `src/features/<feature>/`, each owning its page component + subcomponents (table, form dialog, detail view). Shared primitives in `src/components/ui` (shadcn) and `src/components/layout` + `src/components/common`.

### 3.3 State strategy

- Server-ish data (rooms, tenants, assignments, billing, settings) lives in `localStorage`, accessed only through repositories, consumed via small custom hooks (e.g. `useRooms()`) that wrap repository calls + local `useState`/`useEffect` for reactivity within a page. No global cache/store layer for this iteration — YAGNI. Each hook re-reads from the repository after mutations (create/update/delete) and exposes the same shape a future async API hook would (data, loading flag kept minimal since localStorage is synchronous, error is effectively unused now but the function signatures allow it later).
- UI-only state (dialog open/closed, selected row, form state) stays local to components via `useState`.
- No Redux/Zustand/Jotai.

### 3.4 Repository / storage architecture

```
src/data/
  storage/
    storage.ts          # generic localStorage get/set/remove with JSON (de)serialization, namespaced keys
  repositories/
    roomRepository.ts
    tenantRepository.ts
    assignmentRepository.ts
    billingRepository.ts
    settingsRepository.ts
  seed/
    seedData.ts          # idempotent seeding on first load
```

`storage.ts` exposes generic helpers:
```ts
function readCollection<T>(key: string): T[]
function writeCollection<T>(key: string, items: T[]): void
function readValue<T>(key: string, fallback: T): T
function writeValue<T>(key: string, value: T): void
```

Each repository is a plain object literal implementing an interface (`RoomRepository`, etc.) with `getAll/getById/create/update/delete` (+ domain-specific queries like `assignmentRepository.getActiveByRoomId`). Repositories are the ONLY code that imports `storage.ts`. Components/hooks never touch `localStorage` directly. This boundary is what allows a future Firebase swap: reimplement the repository module bodies (sync → async) behind the same function signatures; call sites (hooks) change from sync calls to `await`, UI stays put.

Repositories generate IDs via `crypto.randomUUID()` and stamp `createdAt`/`updatedAt` (ISO strings).

### 3.5 Domain model additions vs. the raw prompt spec

- `BillingRecord` gains `invoiceNumber?: string` — assigned when the record transitions from `draft` to `issued` (or immediately at creation if created directly as `issued`). No separate `Invoice` entity: the Invoices page is a view over `BillingRecord` filtered/formatted for invoice concerns (number, issue/due date, status, print/preview). This avoids two sources of truth for the same row of data, matching the overlapping columns in both the "Monthly Billing Table" and "Invoice Management" sections of requirements.
- `RoomTenantAssignment` is the only source of truth for which tenant occupies which room. `Room` never stores `tenantId`. "Current tenant for room X" = query `assignmentRepository.getActiveByRoomId(roomId)` then resolve tenant. Only one assignment with `status: "active"` per room at a time (enforced in `assignmentRepository.create`/an `assignTenant` domain function: ending any existing active assignment for that room first).

## 4. Business Rules

- **Assignment exclusivity:** creating a new active assignment for a room auto-ends (`status: "ended"`, `endDate: now`) any prior active assignment for that room, then sets `Room.status = "occupied"`.
- **Ending a tenancy:** marking an assignment `ended` sets `Room.status = "available"` (unless the room was manually set to `maintenance`/`inactive`, in which case status is left as-is — occupancy end shouldn't silently override an explicit maintenance flag).
- **Meter usage:** `usage = Math.max(0, currentMeter - previousMeter)`; `amount = usage * rate`. Never negative.
- **Billing total:** `electricity.amount + water.amount + rentAmount + garbageFee + electricityMeterMaintenanceFee + waterMeterMaintenanceFee + sum(otherCharges.amount)`. `subtotal` = same total minus otherCharges (rent+utilities+fixed fees); `total` = subtotal + otherCharges sum. Computed in `lib/calculations.ts`, never inline in components.
- **Invoice numbering:** `INV-{YYYY}-{MM}-{seq3}` where `seq` is the next running number among existing billing records sharing that year+month (max existing seq for that month + 1, starting at 1). Pure function `generateInvoiceNumber(billingMonth, existingRecords)` in `lib/invoice.ts` — no separate counter storage, derived from existing data so it stays correct even if records are seeded or deleted.
- **Billing status lifecycle:** stored `status` is the single source of truth and changes only via explicit user actions — "Issue" (`draft -> issued`, assigns `invoiceNumber`) and "Mark as Paid" (`-> paid`). `overdue` is never written automatically; a pure helper `resolveBillingStatus(record)` computes the *displayed* status (bumps `issued` to `overdue` when `dueDate` is past) for read-time rendering only, so stored data never silently mutates just from time passing.
- **Validation:** room number required; monthly rent ≥ 0; utility rates ≥ 0; tenant first/last name required; billing current meter ≥ previous meter; all monetary amounts ≥ 0.
- **Deletion:** always confirm via `AlertDialog` (never `window.confirm`), always toast (sonner) on success.

## 5. Feature Scope (this pass)

All sections from the original requirements are in scope for this implementation pass — dashboard, rooms, tenants, assignments, room detail, monthly billing + calculation, billing table, invoices list, invoice preview (Thai document), print/A4 CSS, settings. No phased cut — single continuous build per the provided 18-step workflow.

Explicitly OUT of scope (documented as limitations, not implemented): authentication, multi-property support, real backend/PDF service, payment gateway, automated recurring billing generation, notifications.

## 6. UI Language

Admin dashboard UI: English strings for this pass. Invoice document itself: Thai, matching the reference layout (ใบแจ้งชำระหนี้, ค่าไฟฟ้า, ค่าน้ำประปา, ค่าเช่ารายเดือน, ค่าขยะ, ค่าบำรุงรักษามิเตอร์ ฯลฯ). No i18n library added now (YAGNI for a single-language pass), but UI copy is kept in component-local constants/props rather than deeply interpolated inline strings, so a future bilingual pass can extract them into a translation map without restructuring components.

## 7. Seed Data

Seeded once (idempotent — only runs if `rental.rooms` key is empty) via `src/data/seed/seedData.ts`:
- 6 rooms: mix of `available`, `occupied` (x3), `maintenance`, `inactive`.
- 4 tenants: 3 currently active or occupying, 1 with a fully `ended` assignment (proves history/move-out flow works, doesn't currently occupy anything).
- 3–4 `RoomTenantAssignment` records (including the one ended one).
- 4–6 `BillingRecord`s across the last 2 billing months with mixed statuses (`draft`, `issued`, `paid`, and one old enough to display as overdue) so Dashboard/Recent Billing/Invoices aren't empty on first load.
- `PropertySettings` seeded with an example English property name/address/phone and default rates matching the reference invoice's fee categories.

## 8. Print

`/invoices/:id` is a standalone route (no `AppLayout`) rendering `InvoicePrintView` (Thai document, resembles reference image) plus a small on-screen-only toolbar (Back, Print, Mark as Paid) hidden via `.no-print` + `@media print`. `window.print()` triggers browser print. `@page { size: A4; margin: 10mm; }` in a print stylesheet. No PDF library.

## 9. Folder Structure

Matches the structure given in requirements (`src/app`, `src/components/{ui,layout,common}`, `src/features/{dashboard,rooms,tenants,assignments,billing,invoices,settings}`, `src/data/{repositories,storage,seed}`, `src/hooks`, `src/lib`, `src/types`, `src/styles`), with routing wiring in `src/app/App.tsx` + a `src/app/router.tsx` (route table) and `src/app/AppLayout.tsx` (sidebar/header shell + `<Outlet/>`).

## 10. Verification

`pnpm build` (tsc + vite build) must pass with zero TS errors, no `any`, no dead buttons. `pnpm lint` if the Vite react-ts template's default ESLint config is present. Manual check of responsive breakpoints 375/768/1024/1440 and the print view.

## 11. Deliverables

- Working app satisfying all sections above.
- `README.md` (user-facing) and `context.md` (deep continuation doc for future agents), per requirements.
