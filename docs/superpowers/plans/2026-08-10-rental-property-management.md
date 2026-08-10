# Rental Property Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full frontend-only rental property management app (rooms, tenants, assignments, billing, invoices+print, settings, dashboard) per `docs/superpowers/specs/2026-08-10-rental-property-management-design.md`.

**Architecture:** Vite+React+TS SPA. `localStorage` behind repository interfaces (`src/data/repositories/*`), consumed via thin custom hooks (`src/hooks/*`), never touched directly by components. React Router v7 for real routes, standalone `/invoices/:id` route outside the sidebar shell as the print target. Feature-folder UI under `src/features/*` on top of shadcn/ui (Radix) components.

**Tech Stack:** Vite, React 18+, TypeScript strict, Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first, no `tailwind.config.js`), shadcn/ui, lucide-react, sonner, react-router v7, pnpm.

## Global Constraints

- TypeScript strict mode on; never use `any`; no unused vars/params.
- No backend, no auth, no external DB — `localStorage` only, always through repositories (`src/data/repositories/*`), never `localStorage.*` calls from components/hooks/features.
- Package manager: pnpm only.
- Delete confirmations use shadcn `AlertDialog`, never `window.confirm`.
- Every mutation (create/update/delete/assign/end/issue/mark-paid) shows a `sonner` toast.
- Every main list has an empty state: icon + short text + primary action button.
- Meter usage: `usage = Math.max(0, currentMeter - previousMeter)`; never negative.
- Invoice number format: `INV-{YYYY}-{MM}-{seq3}`, seq derived from existing records for that year+month, never a separate counter.
- `Room` never stores a tenant reference; current tenant is always derived via `RoomTenantAssignment` with `status: "active"`.
- Only one active assignment per room at a time.
- `BillingRecord.status` changes only via explicit actions (Issue, Mark as Paid); "overdue" is display-only via `resolveBillingStatus`, never auto-written to storage.
- Admin UI copy in English for this pass; invoice document copy in Thai (see Task 13).
- Print: standalone `/invoices/:id` route with no sidebar/header; `@page { size: A4; margin: 10mm; }`; no PDF library.
- Responsive down to 375px, no horizontal page overflow (wide tables scroll inside their own container).
- Do **not** run `git commit` during execution — the user commits manually. Steps below say "mark task done," not "commit."
- Do not add react-hook-form, zod, or any state-management library — not required by spec; plain controlled inputs + hand-written validators in `lib/`.

---

## File Structure

```
src/
  main.tsx
  index.css
  vite-env.d.ts
  app/
    App.tsx
    router.tsx
    AppLayout.tsx
  components/
    ui/                     # shadcn-generated, untouched except as CLI produces
    layout/
      AppSidebar.tsx
      AppHeader.tsx
    common/
      EmptyState.tsx
      PageHeader.tsx
      ConfirmDialog.tsx
      StatusBadge.tsx
  types/
    room.ts
    tenant.ts
    assignment.ts
    billing.ts
    settings.ts
  lib/
    utils.ts                # shadcn cn() helper (CLI-generated)
    currency.ts
    date.ts
    calculations.ts
    invoice.ts
    validation.ts
  data/
    storage/storage.ts
    repositories/
      roomRepository.ts
      tenantRepository.ts
      assignmentRepository.ts
      billingRepository.ts
      settingsRepository.ts
    seed/seedData.ts
  hooks/
    useRooms.ts
    useTenants.ts
    useAssignments.ts
    useBillingRecords.ts
    useSettings.ts
  features/
    dashboard/DashboardPage.tsx
    rooms/
      RoomsPage.tsx
      RoomTable.tsx
      RoomFormDialog.tsx
      RoomDetailSheet.tsx
    tenants/
      TenantsPage.tsx
      TenantTable.tsx
      TenantFormDialog.tsx
      TenantDetailSheet.tsx
    assignments/
      AssignTenantDialog.tsx
    billing/
      BillingPage.tsx
      BillingTable.tsx
      BillingFormDialog.tsx
    invoices/
      InvoicesPage.tsx
      InvoicePreviewDialog.tsx
      InvoicePrintView.tsx
      InvoicePrintPage.tsx
    settings/
      SettingsPage.tsx
```

---

### Task 1: Project scaffold — Vite/React/TS, Tailwind v4, shadcn/ui, routing deps

**Files:**
- Create: whole Vite `react-ts` scaffold at repo root (`package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx` placeholder, `src/index.css`, `.eslintrc`/`eslint.config.js` from template)
- Create: `components.json` (shadcn config)
- Modify: `vite.config.ts` to add `@tailwindcss/vite` plugin and `@` path alias
- Modify: `tsconfig.json`/`tsconfig.app.json` to add `@/*` path alias and confirm `"strict": true`

**Interfaces:**
- Produces: working `pnpm dev` / `pnpm build` pipeline, `@/*` import alias resolving to `src/*`, Tailwind v4 utilities available globally, shadcn CLI ready to `add` components, `sonner`, `lucide-react`, and `react-router` installed as dependencies.

- [ ] **Step 1: Scaffold Vite project into repo root**

Run (from repo root, keeping existing `README.md`/`LICENSE`/`.gitignore`):
```bash
pnpm create vite@latest . -- --template react-ts
```
If it refuses because the directory isn't empty, scaffold into a temp dir and move `src/`, `index.html`, config files into the repo root, keeping the existing `README.md`, `LICENSE`, `.gitignore`.

- [ ] **Step 2: Install project dependencies**

```bash
pnpm install
pnpm add react-router lucide-react sonner
```

- [ ] **Step 3: Add Tailwind CSS v4 (CSS-first, no config file)**

```bash
pnpm add tailwindcss @tailwindcss/vite
```
`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```
`src/index.css` (replace generated contents):
```css
@import "tailwindcss";
```

- [ ] **Step 4: Add `@/*` path alias to TypeScript config**

In `tsconfig.json` (or `tsconfig.app.json`, whichever holds `compilerOptions` in the generated template), ensure:
```json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 5: Init shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
```
Confirm it detects Tailwind v4 and writes `components.json` with `"aliases": { "components": "@/components", "utils": "@/lib/utils" }`. If the CLI prompts anyway, answer: TypeScript yes, style "new-york" or default, base color "neutral", CSS variables yes.

- [ ] **Step 6: Add all shadcn components needed by later tasks**

```bash
pnpm dlx shadcn@latest add button card dialog alert-dialog sheet input select dropdown-menu badge tabs table tooltip separator skeleton label textarea
```
This generates `src/components/ui/*.tsx` and `src/lib/utils.ts` (the `cn()` helper) — do not hand-edit generated `ui/` files.

- [ ] **Step 7: Verify the scaffold builds**

Run: `pnpm build`
Expected: succeeds with the default Vite counter app still in place (will be replaced in later tasks). Fix any config issue now before proceeding.

- [ ] **Step 8: Mark task done**

No commit — leave working tree as-is for the user to commit later.

---

### Task 2: Domain types

**Files:**
- Create: `src/types/room.ts`
- Create: `src/types/tenant.ts`
- Create: `src/types/assignment.ts`
- Create: `src/types/billing.ts`
- Create: `src/types/settings.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every type below, imported by repositories/hooks/features in all later tasks. These exact names and fields are load-bearing — do not rename without updating this plan.

- [ ] **Step 1: `src/types/room.ts`**

```ts
export type RoomStatus = "available" | "occupied" | "maintenance" | "inactive";

export interface Room {
  id: string;
  roomNumber: string;
  floor?: string;
  type?: string;
  monthlyRent: number;
  status: RoomStatus;
  description?: string;
  electricityRate: number;
  waterRate: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateRoomInput = Omit<Room, "id" | "createdAt" | "updatedAt" | "status"> & {
  status?: RoomStatus;
};
export type UpdateRoomInput = Partial<Omit<Room, "id" | "createdAt" | "updatedAt">>;
```

- [ ] **Step 2: `src/types/tenant.ts`**

```ts
export type TenantStatus = "active" | "inactive";

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  identificationNumber?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status: TenantStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateTenantInput = Omit<Tenant, "id" | "createdAt" | "updatedAt" | "status"> & {
  status?: TenantStatus;
};
export type UpdateTenantInput = Partial<Omit<Tenant, "id" | "createdAt" | "updatedAt">>;
```

- [ ] **Step 3: `src/types/assignment.ts`**

```ts
export type AssignmentStatus = "active" | "ended";

export interface RoomTenantAssignment {
  id: string;
  roomId: string;
  tenantId: string;
  startDate: string;
  endDate?: string;
  status: AssignmentStatus;
  createdAt: string;
}

export type CreateAssignmentInput = Pick<RoomTenantAssignment, "roomId" | "tenantId" | "startDate">;
```

- [ ] **Step 4: `src/types/billing.ts`**

```ts
export type BillingStatus = "draft" | "issued" | "paid" | "overdue";

export interface BillingCharge {
  id: string;
  name: string;
  amount: number;
}

export interface MeterReading {
  previousMeter: number;
  currentMeter: number;
  usage: number;
  rate: number;
  amount: number;
}

export interface BillingRecord {
  id: string;
  roomId: string;
  tenantId?: string;
  invoiceNumber?: string;
  billingMonth: string; // "YYYY-MM"
  electricity: MeterReading;
  water: MeterReading;
  rentAmount: number;
  garbageFee: number;
  electricityMeterMaintenanceFee: number;
  waterMeterMaintenanceFee: number;
  otherCharges: BillingCharge[];
  subtotal: number;
  total: number;
  status: BillingStatus;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillingInput {
  roomId: string;
  tenantId?: string;
  billingMonth: string;
  electricityPreviousMeter: number;
  electricityCurrentMeter: number;
  electricityRate: number;
  waterPreviousMeter: number;
  waterCurrentMeter: number;
  waterRate: number;
  rentAmount: number;
  garbageFee: number;
  electricityMeterMaintenanceFee: number;
  waterMeterMaintenanceFee: number;
  otherCharges: Omit<BillingCharge, "id">[];
  dueDate?: string;
  status?: BillingStatus;
}

export type UpdateBillingInput = Partial<CreateBillingInput> & { status?: BillingStatus };
```

- [ ] **Step 5: `src/types/settings.ts`**

```ts
export interface PropertySettings {
  propertyName: string;
  propertyAddress: string;
  phone: string;
  defaultElectricityRate: number;
  defaultWaterRate: number;
  defaultGarbageFee: number;
  defaultElectricityMeterMaintenanceFee: number;
  defaultWaterMeterMaintenanceFee: number;
  defaultInvoiceNote: string;
}
```

- [ ] **Step 6: Verify**

Run: `pnpm build` (will fail only if unrelated files break — these are new unused files at this point, so `tsc` should stay green; if `noUnusedLocals` complains about anything, it won't here since nothing is unused within the files themselves).

- [ ] **Step 7: Mark task done**

---

### Task 3: Pure logic utilities (`lib/`)

**Files:**
- Create: `src/lib/currency.ts`
- Create: `src/lib/date.ts`
- Create: `src/lib/calculations.ts`
- Create: `src/lib/invoice.ts`
- Create: `src/lib/validation.ts`

**Interfaces:**
- Consumes: types from Task 2 (`BillingRecord`, `BillingCharge`, `CreateBillingInput`, `Room`, `Tenant`).
- Produces: `formatCurrency`, `formatThaiDate`, `formatDate`, `calculateElectricityUsage`, `calculateWaterUsage`, `calculateBillingAmounts`, `generateInvoiceNumber`, `resolveBillingStatus`, `validateRoom`, `validateTenant`, `validateBilling` — used by hooks/features in every later task.

- [ ] **Step 1: `src/lib/currency.ts`**

```ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

- [ ] **Step 2: `src/lib/date.ts`**

```ts
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export function formatThaiDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = THAI_MONTHS[d.getMonth()];
  const buddhistYear = d.getFullYear() + 543;
  return `${day} ${month} ${buddhistYear}`;
}

export function formatBillingMonth(billingMonth: string): string {
  const [year, month] = billingMonth.split("-").map(Number);
  return `${THAI_MONTHS[month - 1]} ${year + 543}`;
}

export function isPastDue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}
```

- [ ] **Step 3: `src/lib/calculations.ts`**

```ts
import type { BillingCharge, MeterReading } from "@/types/billing";

export function calculateUsage(previousMeter: number, currentMeter: number): number {
  return Math.max(0, currentMeter - previousMeter);
}

export function calculateMeterReading(
  previousMeter: number,
  currentMeter: number,
  rate: number
): MeterReading {
  const usage = calculateUsage(previousMeter, currentMeter);
  return { previousMeter, currentMeter, usage, rate, amount: usage * rate };
}

export interface BillingTotals {
  subtotal: number;
  total: number;
}

export function calculateBillingTotals(params: {
  electricityAmount: number;
  waterAmount: number;
  rentAmount: number;
  garbageFee: number;
  electricityMeterMaintenanceFee: number;
  waterMeterMaintenanceFee: number;
  otherCharges: Pick<BillingCharge, "amount">[];
}): BillingTotals {
  const subtotal =
    params.electricityAmount +
    params.waterAmount +
    params.rentAmount +
    params.garbageFee +
    params.electricityMeterMaintenanceFee +
    params.waterMeterMaintenanceFee;
  const otherTotal = params.otherCharges.reduce((sum, c) => sum + c.amount, 0);
  return { subtotal, total: subtotal + otherTotal };
}
```

- [ ] **Step 4: `src/lib/invoice.ts`**

```ts
import type { BillingRecord, BillingStatus } from "@/types/billing";
import { isPastDue } from "@/lib/date";

export function generateInvoiceNumber(billingMonth: string, existing: BillingRecord[]): string {
  const [year, month] = billingMonth.split("-");
  const prefix = `INV-${year}-${month}-`;
  const maxSeq = existing
    .filter((r) => r.invoiceNumber?.startsWith(prefix))
    .map((r) => Number(r.invoiceNumber!.slice(prefix.length)))
    .reduce((max, n) => (Number.isFinite(n) && n > max ? n : max), 0);
  const next = maxSeq + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function resolveBillingStatus(record: Pick<BillingRecord, "status" | "dueDate">): BillingStatus {
  if (record.status === "issued" && isPastDue(record.dueDate)) return "overdue";
  return record.status;
}
```

- [ ] **Step 5: `src/lib/validation.ts`**

```ts
import type { CreateRoomInput, UpdateRoomInput } from "@/types/room";
import type { CreateTenantInput, UpdateTenantInput } from "@/types/tenant";
import type { CreateBillingInput } from "@/types/billing";

export type ValidationErrors = Record<string, string>;

export function validateRoom(input: Partial<CreateRoomInput & UpdateRoomInput>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.roomNumber || input.roomNumber.trim() === "") errors.roomNumber = "Room number is required";
  if (input.monthlyRent !== undefined && input.monthlyRent < 0) errors.monthlyRent = "Monthly rent cannot be negative";
  if (input.electricityRate !== undefined && input.electricityRate < 0) errors.electricityRate = "Electricity rate cannot be negative";
  if (input.waterRate !== undefined && input.waterRate < 0) errors.waterRate = "Water rate cannot be negative";
  return errors;
}

export function validateTenant(input: Partial<CreateTenantInput & UpdateTenantInput>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.firstName || input.firstName.trim() === "") errors.firstName = "First name is required";
  if (!input.lastName || input.lastName.trim() === "") errors.lastName = "Last name is required";
  return errors;
}

export function validateBilling(input: Partial<CreateBillingInput>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.roomId) errors.roomId = "Room is required";
  if (!input.billingMonth) errors.billingMonth = "Billing month is required";
  if (
    input.electricityCurrentMeter !== undefined &&
    input.electricityPreviousMeter !== undefined &&
    input.electricityCurrentMeter < input.electricityPreviousMeter
  ) {
    errors.electricityCurrentMeter = "Current electricity meter cannot be lower than previous meter";
  }
  if (
    input.waterCurrentMeter !== undefined &&
    input.waterPreviousMeter !== undefined &&
    input.waterCurrentMeter < input.waterPreviousMeter
  ) {
    errors.waterCurrentMeter = "Current water meter cannot be lower than previous meter";
  }
  if (input.rentAmount !== undefined && input.rentAmount < 0) errors.rentAmount = "Rent cannot be negative";
  return errors;
}
```

- [ ] **Step 6: Verify**

Run: `pnpm build`. These files are self-contained and type-check against Task 2's types; fix any mismatch now.

- [ ] **Step 7: Mark task done**

---

### Task 4: Storage layer + repositories + seed data

**Files:**
- Create: `src/data/storage/storage.ts`
- Create: `src/data/repositories/roomRepository.ts`
- Create: `src/data/repositories/tenantRepository.ts`
- Create: `src/data/repositories/assignmentRepository.ts`
- Create: `src/data/repositories/billingRepository.ts`
- Create: `src/data/repositories/settingsRepository.ts`
- Create: `src/data/seed/seedData.ts`

**Interfaces:**
- Consumes: all types from Task 2, `generateInvoiceNumber`/`calculateMeterReading`/`calculateBillingTotals` from Task 3.
- Produces: repository objects (`roomRepository`, `tenantRepository`, `assignmentRepository`, `billingRepository`, `settingsRepository`) each with `getAll/getById/create/update/delete` (plus the domain-specific methods listed below) — these exact names are what Task 5's hooks call. `seedIfEmpty()` — called once from `src/main.tsx` in Task 6.

- [ ] **Step 1: `src/data/storage/storage.ts`**

```ts
const PREFIX = "rental.";

export function readCollection<T>(key: string): T[] {
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function writeCollection<T>(key: string, items: T[]): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(items));
}

export function readValue<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeValue<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export const STORAGE_KEYS = {
  rooms: "rooms",
  tenants: "tenants",
  assignments: "assignments",
  billing: "billing",
  settings: "settings",
} as const;
```

- [ ] **Step 2: `src/data/repositories/roomRepository.ts`**

```ts
import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import type { Room, CreateRoomInput, UpdateRoomInput } from "@/types/room";

function all(): Room[] {
  return readCollection<Room>(STORAGE_KEYS.rooms);
}

export const roomRepository = {
  getAll(): Room[] {
    return all();
  },
  getById(id: string): Room | undefined {
    return all().find((r) => r.id === id);
  },
  create(input: CreateRoomInput): Room {
    const now = new Date().toISOString();
    const room: Room = { ...input, status: input.status ?? "available", id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    writeCollection(STORAGE_KEYS.rooms, [...all(), room]);
    return room;
  },
  update(id: string, input: UpdateRoomInput): Room {
    const rooms = all();
    const index = rooms.findIndex((r) => r.id === id);
    if (index === -1) throw new Error(`Room ${id} not found`);
    const updated: Room = { ...rooms[index], ...input, updatedAt: new Date().toISOString() };
    rooms[index] = updated;
    writeCollection(STORAGE_KEYS.rooms, rooms);
    return updated;
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.rooms, all().filter((r) => r.id !== id));
  },
};
```

- [ ] **Step 3: `src/data/repositories/tenantRepository.ts`**

Same shape as `roomRepository`, over `Tenant`/`CreateTenantInput`/`UpdateTenantInput` and `STORAGE_KEYS.tenants`. `create` defaults `status` to `"active"` when not given.

```ts
import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import type { Tenant, CreateTenantInput, UpdateTenantInput } from "@/types/tenant";

function all(): Tenant[] {
  return readCollection<Tenant>(STORAGE_KEYS.tenants);
}

export const tenantRepository = {
  getAll(): Tenant[] {
    return all();
  },
  getById(id: string): Tenant | undefined {
    return all().find((t) => t.id === id);
  },
  create(input: CreateTenantInput): Tenant {
    const now = new Date().toISOString();
    const tenant: Tenant = { ...input, status: input.status ?? "active", id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    writeCollection(STORAGE_KEYS.tenants, [...all(), tenant]);
    return tenant;
  },
  update(id: string, input: UpdateTenantInput): Tenant {
    const tenants = all();
    const index = tenants.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`Tenant ${id} not found`);
    const updated: Tenant = { ...tenants[index], ...input, updatedAt: new Date().toISOString() };
    tenants[index] = updated;
    writeCollection(STORAGE_KEYS.tenants, tenants);
    return updated;
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.tenants, all().filter((t) => t.id !== id));
  },
};
```

- [ ] **Step 4: `src/data/repositories/assignmentRepository.ts`**

```ts
import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import { roomRepository } from "@/data/repositories/roomRepository";
import type { RoomTenantAssignment, CreateAssignmentInput } from "@/types/assignment";

function all(): RoomTenantAssignment[] {
  return readCollection<RoomTenantAssignment>(STORAGE_KEYS.assignments);
}

export const assignmentRepository = {
  getAll(): RoomTenantAssignment[] {
    return all();
  },
  getById(id: string): RoomTenantAssignment | undefined {
    return all().find((a) => a.id === id);
  },
  getActiveByRoomId(roomId: string): RoomTenantAssignment | undefined {
    return all().find((a) => a.roomId === roomId && a.status === "active");
  },
  getActiveByTenantId(tenantId: string): RoomTenantAssignment | undefined {
    return all().find((a) => a.tenantId === tenantId && a.status === "active");
  },
  getByTenantId(tenantId: string): RoomTenantAssignment[] {
    return all().filter((a) => a.tenantId === tenantId);
  },
  getByRoomId(roomId: string): RoomTenantAssignment[] {
    return all().filter((a) => a.roomId === roomId);
  },
  /** Ends any existing active assignment for the room, creates a new active one, sets room status to occupied. */
  assign(input: CreateAssignmentInput): RoomTenantAssignment {
    const assignments = all();
    const now = new Date().toISOString();
    const ended = assignments.map((a) =>
      a.roomId === input.roomId && a.status === "active"
        ? { ...a, status: "ended" as const, endDate: input.startDate }
        : a
    );
    const created: RoomTenantAssignment = {
      id: crypto.randomUUID(),
      roomId: input.roomId,
      tenantId: input.tenantId,
      startDate: input.startDate,
      status: "active",
      createdAt: now,
    };
    writeCollection(STORAGE_KEYS.assignments, [...ended, created]);
    roomRepository.update(input.roomId, { status: "occupied" });
    return created;
  },
  /** Ends the active assignment for a room; sets room status to available unless it's maintenance/inactive. */
  endByRoomId(roomId: string, endDate: string): void {
    const assignments = all();
    const updated = assignments.map((a) =>
      a.roomId === roomId && a.status === "active" ? { ...a, status: "ended" as const, endDate } : a
    );
    writeCollection(STORAGE_KEYS.assignments, updated);
    const room = roomRepository.getById(roomId);
    if (room && room.status === "occupied") {
      roomRepository.update(roomId, { status: "available" });
    }
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.assignments, all().filter((a) => a.id !== id));
  },
};
```

- [ ] **Step 5: `src/data/repositories/billingRepository.ts`**

```ts
import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import { calculateMeterReading, calculateBillingTotals } from "@/lib/calculations";
import { generateInvoiceNumber } from "@/lib/invoice";
import type { BillingRecord, CreateBillingInput, UpdateBillingInput, BillingCharge } from "@/types/billing";

function all(): BillingRecord[] {
  return readCollection<BillingRecord>(STORAGE_KEYS.billing);
}

function buildCharges(input: Omit<BillingCharge, "id">[]): BillingCharge[] {
  return input.map((c) => ({ ...c, id: crypto.randomUUID() }));
}

function computeRecord(input: CreateBillingInput, id: string, now: string): BillingRecord {
  const electricity = calculateMeterReading(input.electricityPreviousMeter, input.electricityCurrentMeter, input.electricityRate);
  const water = calculateMeterReading(input.waterPreviousMeter, input.waterCurrentMeter, input.waterRate);
  const otherCharges = buildCharges(input.otherCharges);
  const totals = calculateBillingTotals({
    electricityAmount: electricity.amount,
    waterAmount: water.amount,
    rentAmount: input.rentAmount,
    garbageFee: input.garbageFee,
    electricityMeterMaintenanceFee: input.electricityMeterMaintenanceFee,
    waterMeterMaintenanceFee: input.waterMeterMaintenanceFee,
    otherCharges,
  });
  const status = input.status ?? "draft";
  return {
    id,
    roomId: input.roomId,
    tenantId: input.tenantId,
    billingMonth: input.billingMonth,
    electricity,
    water,
    rentAmount: input.rentAmount,
    garbageFee: input.garbageFee,
    electricityMeterMaintenanceFee: input.electricityMeterMaintenanceFee,
    waterMeterMaintenanceFee: input.waterMeterMaintenanceFee,
    otherCharges,
    subtotal: totals.subtotal,
    total: totals.total,
    status,
    invoiceNumber: status === "issued" ? generateInvoiceNumber(input.billingMonth, all()) : undefined,
    issuedAt: status === "issued" ? now : undefined,
    dueDate: input.dueDate,
    createdAt: now,
    updatedAt: now,
  };
}

export const billingRepository = {
  getAll(): BillingRecord[] {
    return all();
  },
  getById(id: string): BillingRecord | undefined {
    return all().find((b) => b.id === id);
  },
  getByRoomId(roomId: string): BillingRecord[] {
    return all().filter((b) => b.roomId === roomId);
  },
  create(input: CreateBillingInput): BillingRecord {
    const now = new Date().toISOString();
    const record = computeRecord(input, crypto.randomUUID(), now);
    writeCollection(STORAGE_KEYS.billing, [...all(), record]);
    return record;
  },
  update(id: string, input: UpdateBillingInput): BillingRecord {
    const records = all();
    const index = records.findIndex((b) => b.id === id);
    if (index === -1) throw new Error(`Billing record ${id} not found`);
    const existing = records[index];
    const merged: CreateBillingInput = {
      roomId: input.roomId ?? existing.roomId,
      tenantId: input.tenantId ?? existing.tenantId,
      billingMonth: input.billingMonth ?? existing.billingMonth,
      electricityPreviousMeter: input.electricityPreviousMeter ?? existing.electricity.previousMeter,
      electricityCurrentMeter: input.electricityCurrentMeter ?? existing.electricity.currentMeter,
      electricityRate: input.electricityRate ?? existing.electricity.rate,
      waterPreviousMeter: input.waterPreviousMeter ?? existing.water.previousMeter,
      waterCurrentMeter: input.waterCurrentMeter ?? existing.water.currentMeter,
      waterRate: input.waterRate ?? existing.water.rate,
      rentAmount: input.rentAmount ?? existing.rentAmount,
      garbageFee: input.garbageFee ?? existing.garbageFee,
      electricityMeterMaintenanceFee: input.electricityMeterMaintenanceFee ?? existing.electricityMeterMaintenanceFee,
      waterMeterMaintenanceFee: input.waterMeterMaintenanceFee ?? existing.waterMeterMaintenanceFee,
      otherCharges: input.otherCharges ?? existing.otherCharges,
      dueDate: input.dueDate ?? existing.dueDate,
      status: input.status ?? existing.status,
    };
    const recomputed = computeRecord(merged, existing.id, existing.createdAt);
    const wasIssuedNow = existing.status !== "issued" && recomputed.status === "issued";
    const updated: BillingRecord = {
      ...recomputed,
      invoiceNumber: wasIssuedNow ? generateInvoiceNumber(merged.billingMonth, all().filter((b) => b.id !== id)) : existing.invoiceNumber ?? recomputed.invoiceNumber,
      issuedAt: wasIssuedNow ? new Date().toISOString() : existing.issuedAt,
      paidAt: recomputed.status === "paid" ? existing.paidAt ?? new Date().toISOString() : existing.paidAt,
      updatedAt: new Date().toISOString(),
    };
    records[index] = updated;
    writeCollection(STORAGE_KEYS.billing, records);
    return updated;
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.billing, all().filter((b) => b.id !== id));
  },
};
```

- [ ] **Step 6: `src/data/repositories/settingsRepository.ts`**

```ts
import { readValue, writeValue, STORAGE_KEYS } from "@/data/storage/storage";
import type { PropertySettings } from "@/types/settings";

const DEFAULTS: PropertySettings = {
  propertyName: "Sunrise Apartments",
  propertyAddress: "",
  phone: "",
  defaultElectricityRate: 8,
  defaultWaterRate: 18,
  defaultGarbageFee: 50,
  defaultElectricityMeterMaintenanceFee: 30,
  defaultWaterMeterMaintenanceFee: 30,
  defaultInvoiceNote: "Please pay by the due date to avoid late fees.",
};

export const settingsRepository = {
  get(): PropertySettings {
    return readValue<PropertySettings>(STORAGE_KEYS.settings, DEFAULTS);
  },
  update(input: Partial<PropertySettings>): PropertySettings {
    const merged = { ...settingsRepository.get(), ...input };
    writeValue(STORAGE_KEYS.settings, merged);
    return merged;
  },
};
```

- [ ] **Step 7: `src/data/seed/seedData.ts`**

```ts
import { roomRepository } from "@/data/repositories/roomRepository";
import { tenantRepository } from "@/data/repositories/tenantRepository";
import { assignmentRepository } from "@/data/repositories/assignmentRepository";
import { billingRepository } from "@/data/repositories/billingRepository";
import { settingsRepository } from "@/data/repositories/settingsRepository";

export function seedIfEmpty(): void {
  if (roomRepository.getAll().length > 0) return;

  settingsRepository.update({
    propertyName: "Sunrise Apartments",
    propertyAddress: "123 Sukhumvit Road, Bangkok 10110",
    phone: "02-123-4567",
  });

  const rooms = [
    roomRepository.create({ roomNumber: "101", floor: "1", type: "Studio", monthlyRent: 4500, electricityRate: 8, waterRate: 18, status: "available" }),
    roomRepository.create({ roomNumber: "102", floor: "1", type: "Studio", monthlyRent: 4500, electricityRate: 8, waterRate: 18 }),
    roomRepository.create({ roomNumber: "201", floor: "2", type: "1 Bedroom", monthlyRent: 6500, electricityRate: 8, waterRate: 18 }),
    roomRepository.create({ roomNumber: "202", floor: "2", type: "1 Bedroom", monthlyRent: 6500, electricityRate: 8, waterRate: 18 }),
    roomRepository.create({ roomNumber: "203", floor: "2", type: "1 Bedroom", monthlyRent: 6800, electricityRate: 8, waterRate: 18, status: "maintenance", description: "Waiting on plumbing repair" }),
    roomRepository.create({ roomNumber: "301", floor: "3", type: "2 Bedroom", monthlyRent: 9500, electricityRate: 8, waterRate: 18, status: "inactive", description: "Under renovation, not yet listed" }),
  ];

  const tenants = [
    tenantRepository.create({ firstName: "Somchai", lastName: "Jaidee", phone: "081-111-2222", email: "somchai@example.com" }),
    tenantRepository.create({ firstName: "Nari", lastName: "Suksawat", phone: "082-222-3333", email: "nari@example.com" }),
    tenantRepository.create({ firstName: "Kittipong", lastName: "Rattana", phone: "083-333-4444" }),
    tenantRepository.create({ firstName: "Ploy", lastName: "Wongsa", phone: "084-444-5555", status: "inactive" }),
  ];

  assignmentRepository.assign({ roomId: rooms[1].id, tenantId: tenants[0].id, startDate: "2026-05-01" });
  assignmentRepository.assign({ roomId: rooms[2].id, tenantId: tenants[1].id, startDate: "2026-04-01" });
  assignmentRepository.assign({ roomId: rooms[3].id, tenantId: tenants[2].id, startDate: "2026-06-01" });

  const pastAssignment = assignmentRepository.assign({ roomId: rooms[0].id, tenantId: tenants[3].id, startDate: "2026-01-01" });
  assignmentRepository.endByRoomId(rooms[0].id, "2026-06-30");
  void pastAssignment;

  billingRepository.create({
    roomId: rooms[1].id, tenantId: tenants[0].id, billingMonth: "2026-06",
    electricityPreviousMeter: 1200, electricityCurrentMeter: 1340, electricityRate: 8,
    waterPreviousMeter: 300, waterCurrentMeter: 320, waterRate: 18,
    rentAmount: 4500, garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30,
    otherCharges: [], dueDate: "2026-07-05", status: "paid",
  });
  billingRepository.create({
    roomId: rooms[2].id, tenantId: tenants[1].id, billingMonth: "2026-06",
    electricityPreviousMeter: 2100, electricityCurrentMeter: 2260, electricityRate: 8,
    waterPreviousMeter: 410, waterCurrentMeter: 435, waterRate: 18,
    rentAmount: 6500, garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30,
    otherCharges: [], dueDate: "2026-07-05", status: "issued",
  });
  billingRepository.create({
    roomId: rooms[3].id, tenantId: tenants[2].id, billingMonth: "2026-06",
    electricityPreviousMeter: 980, electricityCurrentMeter: 1085, electricityRate: 8,
    waterPreviousMeter: 210, waterCurrentMeter: 228, waterRate: 18,
    rentAmount: 6500, garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30,
    otherCharges: [{ name: "Parking", amount: 300 }], dueDate: "2026-06-20", status: "issued",
  });
  billingRepository.create({
    roomId: rooms[1].id, tenantId: tenants[0].id, billingMonth: "2026-07",
    electricityPreviousMeter: 1340, electricityCurrentMeter: 1470, electricityRate: 8,
    waterPreviousMeter: 320, waterCurrentMeter: 342, waterRate: 18,
    rentAmount: 4500, garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30,
    otherCharges: [], dueDate: "2026-08-05", status: "draft",
  });
}
```

Note: the 2026-06-20 due date on the third seeded record is in the past relative to the app's "today" (2026-08-10), so it will render as **overdue** via `resolveBillingStatus` — this is intentional, giving the dashboard/invoices list a real overdue example.

- [ ] **Step 8: Verify**

Run: `pnpm build`. All repository/seed files must type-check cleanly against Task 2/3 types.

- [ ] **Step 9: Mark task done**

---

### Task 5: Custom hooks

**Files:**
- Create: `src/hooks/useRooms.ts`
- Create: `src/hooks/useTenants.ts`
- Create: `src/hooks/useAssignments.ts`
- Create: `src/hooks/useBillingRecords.ts`
- Create: `src/hooks/useSettings.ts`

**Interfaces:**
- Consumes: repositories from Task 4.
- Produces: hooks used by every feature component in Tasks 8–14. Each list hook returns `{ data, refresh, create, update, remove }`-shaped objects (exact shape below) so components never call repositories directly.

- [ ] **Step 1: `src/hooks/useRooms.ts`**

```ts
import { useCallback, useState } from "react";
import { roomRepository } from "@/data/repositories/roomRepository";
import type { Room, CreateRoomInput, UpdateRoomInput } from "@/types/room";

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>(() => roomRepository.getAll());

  const refresh = useCallback(() => setRooms(roomRepository.getAll()), []);

  const createRoom = useCallback((input: CreateRoomInput) => {
    const room = roomRepository.create(input);
    refresh();
    return room;
  }, [refresh]);

  const updateRoom = useCallback((id: string, input: UpdateRoomInput) => {
    const room = roomRepository.update(id, input);
    refresh();
    return room;
  }, [refresh]);

  const deleteRoom = useCallback((id: string) => {
    roomRepository.delete(id);
    refresh();
  }, [refresh]);

  return { rooms, refresh, createRoom, updateRoom, deleteRoom };
}
```

- [ ] **Step 2: `src/hooks/useTenants.ts`**

Same shape over `tenantRepository`: `{ tenants, refresh, createTenant, updateTenant, deleteTenant }`.

```ts
import { useCallback, useState } from "react";
import { tenantRepository } from "@/data/repositories/tenantRepository";
import type { Tenant, CreateTenantInput, UpdateTenantInput } from "@/types/tenant";

export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>(() => tenantRepository.getAll());

  const refresh = useCallback(() => setTenants(tenantRepository.getAll()), []);

  const createTenant = useCallback((input: CreateTenantInput) => {
    const tenant = tenantRepository.create(input);
    refresh();
    return tenant;
  }, [refresh]);

  const updateTenant = useCallback((id: string, input: UpdateTenantInput) => {
    const tenant = tenantRepository.update(id, input);
    refresh();
    return tenant;
  }, [refresh]);

  const deleteTenant = useCallback((id: string) => {
    tenantRepository.delete(id);
    refresh();
  }, [refresh]);

  return { tenants, refresh, createTenant, updateTenant, deleteTenant };
}
```

- [ ] **Step 3: `src/hooks/useAssignments.ts`**

```ts
import { useCallback, useState } from "react";
import { assignmentRepository } from "@/data/repositories/assignmentRepository";
import type { RoomTenantAssignment, CreateAssignmentInput } from "@/types/assignment";

export function useAssignments() {
  const [assignments, setAssignments] = useState<RoomTenantAssignment[]>(() => assignmentRepository.getAll());

  const refresh = useCallback(() => setAssignments(assignmentRepository.getAll()), []);

  const assignTenant = useCallback((input: CreateAssignmentInput) => {
    const assignment = assignmentRepository.assign(input);
    refresh();
    return assignment;
  }, [refresh]);

  const endTenancyByRoomId = useCallback((roomId: string, endDate: string) => {
    assignmentRepository.endByRoomId(roomId, endDate);
    refresh();
  }, [refresh]);

  const getActiveByRoomId = useCallback((roomId: string) => assignmentRepository.getActiveByRoomId(roomId), []);
  const getByRoomId = useCallback((roomId: string) => assignmentRepository.getByRoomId(roomId), []);
  const getActiveByTenantId = useCallback((tenantId: string) => assignmentRepository.getActiveByTenantId(tenantId), []);

  return { assignments, refresh, assignTenant, endTenancyByRoomId, getActiveByRoomId, getByRoomId, getActiveByTenantId };
}
```

- [ ] **Step 4: `src/hooks/useBillingRecords.ts`**

```ts
import { useCallback, useState } from "react";
import { billingRepository } from "@/data/repositories/billingRepository";
import type { BillingRecord, CreateBillingInput, UpdateBillingInput } from "@/types/billing";

export function useBillingRecords() {
  const [records, setRecords] = useState<BillingRecord[]>(() => billingRepository.getAll());

  const refresh = useCallback(() => setRecords(billingRepository.getAll()), []);

  const createBilling = useCallback((input: CreateBillingInput) => {
    const record = billingRepository.create(input);
    refresh();
    return record;
  }, [refresh]);

  const updateBilling = useCallback((id: string, input: UpdateBillingInput) => {
    const record = billingRepository.update(id, input);
    refresh();
    return record;
  }, [refresh]);

  const deleteBilling = useCallback((id: string) => {
    billingRepository.delete(id);
    refresh();
  }, [refresh]);

  return { records, refresh, createBilling, updateBilling, deleteBilling };
}
```

- [ ] **Step 5: `src/hooks/useSettings.ts`**

```ts
import { useCallback, useState } from "react";
import { settingsRepository } from "@/data/repositories/settingsRepository";
import type { PropertySettings } from "@/types/settings";

export function useSettings() {
  const [settings, setSettings] = useState<PropertySettings>(() => settingsRepository.get());

  const updateSettings = useCallback((input: Partial<PropertySettings>) => {
    const updated = settingsRepository.update(input);
    setSettings(updated);
    return updated;
  }, []);

  return { settings, updateSettings };
}
```

- [ ] **Step 6: Verify**

Run: `pnpm build`.

- [ ] **Step 7: Mark task done**

---

### Task 6: App shell — routing, layout, sidebar, header, toaster

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/app/router.tsx`
- Create: `src/app/AppLayout.tsx`
- Create: `src/components/layout/AppSidebar.tsx`
- Create: `src/components/layout/AppHeader.tsx`
- Modify: `src/main.tsx` (call `seedIfEmpty()` once before render, mount `<App />`)

**Interfaces:**
- Consumes: `seedIfEmpty` (Task 4), shadcn `Sheet`/`Button`/`Separator` (Task 1).
- Produces: mounted routes at `/dashboard`, `/rooms`, `/tenants`, `/billing`, `/invoices`, `/invoices/:id`, `/settings`, `/` redirecting to `/dashboard`. Every later feature page is registered here.

- [ ] **Step 1: `src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { seedIfEmpty } from "@/data/seed/seedData";
import App from "@/app/App";
import "@/index.css";

seedIfEmpty();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 2: `src/components/layout/AppSidebar.tsx`**

Nav items: Dashboard (`LayoutDashboard` icon), Rooms (`DoorOpen`), Tenants (`Users`), Billing (`Receipt`), Invoices (`FileText`), Settings (`Settings`) — each a `NavLink` to its route, active state styled distinctly (e.g. `bg-accent text-accent-foreground` when `isActive`). Fixed width column on desktop (`hidden md:flex md:w-60 md:flex-col md:border-r`), not rendered directly on mobile (mobile nav lives in `AppHeader`'s `Sheet`). Top of sidebar shows the property name from settings (or a static "Rental Manager" title + building icon if wiring settings here is inconvenient — simplest: static app title "Rental Manager" with `Building2` icon, since property name already appears on Dashboard/Settings).

Props: none (reads route via `NavLink`/`useLocation` internally).

- [ ] **Step 3: `src/components/layout/AppHeader.tsx`**

Desktop: shows current page title (derive from `useLocation().pathname` via a small local map) and is otherwise minimal. Mobile (`<md`): shows a hamburger `Button` (`variant="ghost" size="icon"`) that opens a shadcn `Sheet` (`side="left"`) containing the same nav items as `AppSidebar` (reuse by extracting the nav item list into `AppSidebar` and rendering `<AppSidebar />`'s content inside the `Sheet` too, or export a shared `<NavItems onNavigate={() => setOpen(false)} />` sub-component from `AppSidebar.tsx` and use it in both places). Closes the sheet on navigation.

- [ ] **Step 4: `src/app/AppLayout.tsx`**

```tsx
import { Outlet } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <Toaster richColors closeButton />
    </div>
  );
}
```

(If `pnpm dlx shadcn add sonner` did not generate `src/components/ui/sonner.tsx` in Task 1, add it now: `pnpm dlx shadcn@latest add sonner`.)

- [ ] **Step 5: `src/app/router.tsx`**

```tsx
import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/app/AppLayout";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { RoomsPage } from "@/features/rooms/RoomsPage";
import { TenantsPage } from "@/features/tenants/TenantsPage";
import { BillingPage } from "@/features/billing/BillingPage";
import { InvoicesPage } from "@/features/invoices/InvoicesPage";
import { InvoicePrintPage } from "@/features/invoices/InvoicePrintPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "rooms", element: <RoomsPage /> },
      { path: "tenants", element: <TenantsPage /> },
      { path: "billing", element: <BillingPage /> },
      { path: "invoices", element: <InvoicesPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  { path: "/invoices/:id", element: <InvoicePrintPage /> },
]);
```

- [ ] **Step 6: `src/app/App.tsx`**

```tsx
import { RouterProvider } from "react-router";
import { router } from "@/app/router";

export default function App() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 7: Verify**

Run: `pnpm build`. This task's imports reference feature pages that don't exist yet (Tasks 8–14) — to keep this task's build green in isolation, create trivial placeholder components for each (`export function DashboardPage() { return <div>Dashboard</div>; }` etc.) in their target files now; later tasks replace the placeholder body, not the export signature.

- [ ] **Step 8: Mark task done**

---

### Task 7: Shared common components

**Files:**
- Create: `src/components/common/EmptyState.tsx`
- Create: `src/components/common/PageHeader.tsx`
- Create: `src/components/common/ConfirmDialog.tsx`
- Create: `src/components/common/StatusBadge.tsx`

**Interfaces:**
- Consumes: shadcn `Button`, `Badge`, `AlertDialog*` (Task 1), any `lucide-react` icon component.
- Produces: `<EmptyState icon title description action? />`, `<PageHeader title description? actions? />`, `<ConfirmDialog open onOpenChange title description onConfirm confirmLabel? variant? />`, `<StatusBadge status kind="room"|"tenant"|"billing" />` — used across every feature page in Tasks 8–14.

- [ ] **Step 1: `src/components/common/EmptyState.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
```

- [ ] **Step 2: `src/components/common/PageHeader.tsx`**

```tsx
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 3: `src/components/common/ConfirmDialog.tsx`**

```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, onConfirm }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: `src/components/common/StatusBadge.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RoomStatus } from "@/types/room";
import type { TenantStatus } from "@/types/tenant";
import type { BillingStatus } from "@/types/billing";

type Status = RoomStatus | TenantStatus | BillingStatus;

const STYLES: Record<Status, string> = {
  available: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  occupied: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  maintenance: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  inactive: "bg-slate-100 text-slate-600 hover:bg-slate-100",
  active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  draft: "bg-slate-100 text-slate-600 hover:bg-slate-100",
  issued: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  paid: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  overdue: "bg-red-100 text-red-800 hover:bg-red-100",
  ended: "bg-slate-100 text-slate-600 hover:bg-slate-100",
};

const LABELS: Record<Status, string> = {
  available: "Available", occupied: "Occupied", maintenance: "Maintenance", inactive: "Inactive",
  active: "Active", draft: "Draft", issued: "Issued", paid: "Paid", overdue: "Overdue", ended: "Ended",
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge className={cn("border-none font-medium", STYLES[status])}>{LABELS[status]}</Badge>;
}
```

- [ ] **Step 5: Verify**

Run: `pnpm build`.

- [ ] **Step 6: Mark task done**

---

### Task 8: Dashboard page

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx` (replace Task 6 placeholder)

**Interfaces:**
- Consumes: `useRooms`, `useTenants`, `useBillingRecords` (Task 5), `resolveBillingStatus`/`formatCurrency`/`formatBillingMonth` (Task 3), `StatusBadge`/`PageHeader` (Task 7), shadcn `Card`/`Table`/`Button`.
- Produces: nothing consumed by later tasks (leaf page), but its "Add Room"/"Add Tenant"/"Create Monthly Billing" quick actions must `navigate()` to `/rooms`, `/tenants`, `/billing` respectively (dialogs for create-on-dashboard are out of scope — navigating to the target page's own "Add" flow satisfies "quick action" without duplicating form logic in two places).

- [ ] **Step 1: Implement summary cards row**

4–6 shadcn `Card`s in a responsive grid (`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`): Total Rooms (`rooms.length`), Occupied (`rooms.filter(r => r.status === "occupied").length`), Available (`status === "available"`), Total Tenants (`tenants.filter(t => t.status === "active").length`), Estimated Monthly Income (`formatCurrency(rooms.filter(r => r.status === "occupied").reduce((sum, r) => sum + r.monthlyRent, 0))`), Outstanding Invoices (count of billing records where `resolveBillingStatus(r) === "issued" || resolveBillingStatus(r) === "overdue"`). Each card: icon (lucide: `DoorOpen`, `CheckCircle2`, `Users`, `Wallet`, `AlertCircle`), label, big value.

- [ ] **Step 2: Implement Room Status Overview**

A `Card` with a small breakdown: for each of `occupied`/`available`/`maintenance`/`inactive`, show count + a `Badge`/`StatusBadge` and a simple proportional bar (`<div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} /></div>`) — no charting library needed.

- [ ] **Step 3: Implement Recent Billing table**

`Card` containing a shadcn `Table` of the 5 most recent billing records (sort `records` by `createdAt` desc, `slice(0, 5)`). Columns: Room number (look up via `rooms.find(r => r.id === record.roomId)?.roomNumber`), Tenant (look up via `tenants`, else "—"), Billing month (`formatBillingMonth`), Amount (`formatCurrency(record.total)`), Status (`<StatusBadge status={resolveBillingStatus(record)} />`). If `records.length === 0`, render `EmptyState` instead (icon `Receipt`, title "No billing records yet", action "Create Monthly Billing" navigating to `/billing`).

- [ ] **Step 4: Implement Quick Actions**

Row of 4 `Button`s: "Add Room" → `navigate("/rooms")`, "Add Tenant" → `navigate("/tenants")`, "Create Monthly Billing" → `navigate("/billing")`, "View Invoices" → `navigate("/invoices")`. (The target pages open their own create dialog via their own "Add" button — dashboard just gets the admin to the right screen; this matches "quick actions," not a second create-form implementation.)

- [ ] **Step 5: Verify**

Run: `pnpm build`, then `pnpm dev` and manually load `/dashboard` — confirm seeded numbers are non-zero and match `seedData.ts`.

- [ ] **Step 6: Mark task done**

---

### Task 9: Rooms feature

**Files:**
- Modify: `src/features/rooms/RoomsPage.tsx` (replace Task 6 placeholder)
- Create: `src/features/rooms/RoomTable.tsx`
- Create: `src/features/rooms/RoomFormDialog.tsx`
- Create: `src/features/rooms/RoomDetailSheet.tsx`

**Interfaces:**
- Consumes: `useRooms`, `useAssignments`, `useTenants` (Task 5), `validateRoom` (Task 3), `StatusBadge`/`EmptyState`/`PageHeader`/`ConfirmDialog` (Task 7), shadcn `Table`/`Dialog`/`Sheet`/`DropdownMenu`/`Select`/`Input`/`Label`.
- Produces:
  - `<RoomTable rooms tenantNameByRoomId onView onEdit onDelete onAssign />` — `tenantNameByRoomId: Record<string, string>` precomputed by `RoomsPage`.
  - `<RoomFormDialog open onOpenChange room? onSubmit={(input) => void}` — `room` present = edit mode, absent = create mode.
  - `<RoomDetailSheet open onOpenChange room tenant? assignment? billingHistory />` — used again by Task 11's assign flow indirectly (Room detail's "Assign Tenant" button opens `AssignTenantDialog` from Task 11).

- [ ] **Step 1: `RoomFormDialog.tsx`**

Fields (all in a `Dialog` on desktop; same component works full-width on mobile since `DialogContent` is already responsive): Room Number (`Input`, required), Floor (`Input`, optional), Type (`Input`, optional), Monthly Rent (`Input type="number"`, required, ≥0), Electricity Rate (`Input type="number"`, defaults to `settingsRepository.get().defaultElectricityRate` via `useSettings()` when creating), Water Rate (same, default `defaultWaterRate`), Status (`Select` with the 4 `RoomStatus` values, default `"available"`), Description (`Textarea`, optional). On submit: run `validateRoom`, if errors show them inline under each field (red text) and stop; else call `onSubmit`, show `toast.success("Room saved")` (or "created"/"updated" verbiage), close dialog. Local component state holds the form; when `room` prop is provided, initialize from it via `useState(() => ...)` (no `useEffect` needed since the dialog remounts per-open via a `key` on the parent's conditional render, or reset explicitly in the `onOpenChange` handler when opening for a different room).

- [ ] **Step 2: `RoomTable.tsx`**

Columns: Room Number, Floor, Type, Tenant (from `tenantNameByRoomId[room.id] ?? "—"`), Monthly Rent (`formatCurrency`), Status (`StatusBadge`), Actions. Actions column: a `DropdownMenu` (trigger: `MoreHorizontal` icon button) with items View / Edit / Assign Tenant / Delete (`Delete` styled destructive, disabled+tooltip "End current tenancy first" is NOT required — deleting a room with an active tenant is allowed for this demo but the confirm dialog text should mention it if `tenantNameByRoomId[room.id]` is set, e.g. "Room 101 currently has a tenant. Delete anyway?"). Wrap the `<Table>` in `<div className="w-full overflow-x-auto">` for horizontal scroll on narrow screens (do not switch to a card layout for Rooms — column count is modest enough for scroll, per spec's "use horizontal scroll where appropriate").

- [ ] **Step 3: `RoomDetailSheet.tsx`**

Shadcn `Sheet` (`side="right"`, wide on desktop via `className="sm:max-w-lg"`). Sections: Room Information (room number/floor/type/rent/status badge/description), Current Tenant (name + phone + lease start/end from the active assignment, or "No tenant assigned" text if none), Utility Settings (electricity/water rate), Billing History (small table: billing month, total, `StatusBadge`, using `billingRepository.getByRoomId` results passed in as a prop — fetched by `RoomsPage` on open, not inside the Sheet itself, keeping this component presentation-only).

- [ ] **Step 4: `RoomsPage.tsx`**

State: `formOpen`, `editingRoom: Room | null`, `detailRoom: Room | null`, `deletingRoom: Room | null`, `assigningRoom: Room | null` (consumed by Task 11's `AssignTenantDialog`). Compute `tenantNameByRoomId` once per render from `assignments`+`tenants` (active assignment per room → tenant → `${firstName} ${lastName}`). `<PageHeader title="Rooms" actions={<Button onClick={() => { setEditingRoom(null); setFormOpen(true); }}><Plus /> Add Room</Button>} />`. If `rooms.length === 0`, render `EmptyState` (icon `DoorOpen`, "No rooms yet", action "Add Room"). Else render `RoomTable`. Wire `onDelete` to open a `ConfirmDialog` with text `` `Delete room ${room.roomNumber}?` `` (English per Task 6's UI-language decision — Thai example in spec was illustrative of tone, not a literal string requirement), on confirm call `deleteRoom(id)` then `toast.success("Room deleted")`.

- [ ] **Step 5: Verify**

Run: `pnpm build`, `pnpm dev`, manually test create/edit/delete/view on `/rooms` at 375px/768px/1440px widths.

- [ ] **Step 6: Mark task done**

---

### Task 10: Tenants feature

**Files:**
- Modify: `src/features/tenants/TenantsPage.tsx` (replace Task 6 placeholder)
- Create: `src/features/tenants/TenantTable.tsx`
- Create: `src/features/tenants/TenantFormDialog.tsx`
- Create: `src/features/tenants/TenantDetailSheet.tsx`

**Interfaces:**
- Consumes: `useTenants`, `useAssignments`, `useRooms` (Task 5), `validateTenant` (Task 3), shared components (Task 7).
- Produces: mirrors Task 9's shape — `<TenantTable tenants roomNameByTenantId onView onEdit onDelete onAssign />`, `<TenantFormDialog open onOpenChange tenant? onSubmit />`, `<TenantDetailSheet open onOpenChange tenant currentRoom? leaseStart? leaseEnd? />`.

- [ ] **Step 1: `TenantFormDialog.tsx`**

Fields: First Name (required), Last Name (required), Phone, Email, Identification Number, Address, Emergency Contact Name, Emergency Contact Phone, Status (`Select`: active/inactive), Notes (`Textarea`). Same validate/submit/toast pattern as `RoomFormDialog`.

- [ ] **Step 2: `TenantTable.tsx`**

Columns: Name (`${firstName} ${lastName}`), Phone, Current Room (`roomNameByTenantId[tenant.id] ?? "—"`), Lease Start, Lease End (both from the tenant's active assignment, blank if none), Status (`StatusBadge`), Actions (`DropdownMenu`: View / Edit / Assign / Move Room / Delete). Same `overflow-x-auto` wrapper as Task 9.

- [ ] **Step 3: `TenantDetailSheet.tsx`**

Sections: full name, phone, email, ID number, address, emergency contact, lease information (start/end dates), current room (room number, link-styled button that could later navigate to Rooms — for now just display text), notes.

- [ ] **Step 4: `TenantsPage.tsx`**

Mirrors `RoomsPage.tsx` structure: compute `roomNameByTenantId` from `assignments`+`rooms`, header with "Add Tenant", empty state (icon `Users`, "No tenants yet"), delete confirm text `` `Delete tenant ${firstName} ${lastName}?` ``, toast on success.

- [ ] **Step 5: Verify**

Run: `pnpm build`, manual CRUD check on `/tenants`.

- [ ] **Step 6: Mark task done**

---

### Task 11: Tenant/room assignment flow

**Files:**
- Create: `src/features/assignments/AssignTenantDialog.tsx`
- Modify: `src/features/rooms/RoomsPage.tsx` (wire "Assign Tenant" action + "End Tenancy" action)
- Modify: `src/features/tenants/TenantsPage.tsx` (wire "Assign / Move Room" action)

**Interfaces:**
- Consumes: `useAssignments().assignTenant`/`endTenancyByRoomId`, `useRooms`, `useTenants` (Task 5).
- Produces: `<AssignTenantDialog open onOpenChange mode="room"|"tenant" subject={Room | Tenant} availableOptions onAssigned />` — `mode="room"` lets the admin pick a tenant for a given room (used from Rooms); `mode="tenant"` lets the admin pick a room for a given tenant (used from Tenants, covers "Move room" too since assigning a new room to an already-assigned tenant just calls `assignTenant` again, which ends their old room's assignment as a side effect of `assignmentRepository.assign`... **note:** `assign()` in Task 4 only ends the *room's* prior active assignment, not the tenant's prior room if they're moving to a different room — add a check here: before calling `assignTenant`, if the tenant already has an active assignment elsewhere (`getActiveByTenantId`), call `endTenancyByRoomId(oldAssignment.roomId, today)` first, then `assignTenant(...)` for the new room.

- [ ] **Step 1: `AssignTenantDialog.tsx`**

Props:
```ts
interface AssignTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "room" | "tenant";
  room?: Room;    // required when mode === "room"
  tenant?: Tenant; // required when mode === "tenant"
  availableRooms: Room[];   // rooms with status "available", used when mode === "tenant"
  availableTenants: Tenant[]; // tenants with no active assignment, used when mode === "room"
  onAssign: (params: { roomId: string; tenantId: string; startDate: string }) => void;
}
```
Body: a `Select` to pick the counterpart (tenant list when `mode="room"`, room list when `mode="tenant"`) plus a start-date `Input type="date"` (default today, `new Date().toISOString().slice(0, 10)`). Submit button "Assign" calls `onAssign`. If the relevant list is empty, show inline text "No available rooms" / "No unassigned tenants" instead of the `Select`.

- [ ] **Step 2: Wire into `RoomsPage.tsx`**

Add `assigningRoom: Room | null` state; the `RoomTable`'s "Assign Tenant" action sets it. Render `<AssignTenantDialog mode="room" room={assigningRoom} availableTenants={tenants.filter(t => t.status === "active" && !getActiveByTenantId(t.id))} onAssign={({ roomId, tenantId, startDate }) => { assignTenant({ roomId, tenantId, startDate }); toast.success("Tenant assigned"); }} />`. Add an "End Tenancy" action in `RoomTable`'s dropdown (visible only when the room has a current tenant) that opens a `ConfirmDialog` ("End this tenancy? Room will become available.") calling `endTenancyByRoomId(room.id, new Date().toISOString().slice(0,10))` then `toast.success("Tenancy ended")`.

- [ ] **Step 3: Wire into `TenantsPage.tsx`**

Same pattern with `mode="tenant"`, `availableRooms={rooms.filter(r => r.status === "available")}`. Before calling `assignTenant` in the `onAssign` handler here, check `getActiveByTenantId(tenant.id)` — if present and its `roomId` differs from the newly chosen room, call `endTenancyByRoomId(oldRoomId, startDate)` first (this is the "Move room" behavior).

- [ ] **Step 4: Verify**

Run: `pnpm build`, `pnpm dev`. Manually: assign a tenant to an available room from Rooms page (room becomes occupied, tenant shows on Tenants page), end that tenancy (room becomes available again), assign a tenant already in one room to a different room from the Tenants page (old room becomes available, new room becomes occupied) — confirms "only one active assignment per room" and move-room both hold.

- [ ] **Step 5: Mark task done**

---

### Task 12: Monthly billing feature

**Files:**
- Modify: `src/features/billing/BillingPage.tsx` (replace Task 6 placeholder)
- Create: `src/features/billing/BillingTable.tsx`
- Create: `src/features/billing/BillingFormDialog.tsx`

**Interfaces:**
- Consumes: `useBillingRecords`, `useRooms`, `useTenants`, `useAssignments`, `useSettings` (Task 5), `validateBilling`, `calculateMeterReading`, `calculateBillingTotals` (Task 3), shared components (Task 7).
- Produces: leaf feature; `BillingFormDialog` is also reused conceptually (same component, imported directly) if a "Create Monthly Billing" deep-link ever needs prefilling — not required now, no export beyond the component itself.

- [ ] **Step 1: `BillingFormDialog.tsx` — form fields and live calculation**

Props: `{ open, onOpenChange, rooms, tenants, activeAssignments: RoomTenantAssignment[], record?: BillingRecord, onSubmit: (input: CreateBillingInput) => void }`. Fields, grouped visually (`Separator` between groups):
- Room (`Select` of `rooms`, required). On change (create mode only), auto-fill Electricity Rate / Water Rate from the selected room's `electricityRate`/`waterRate`, Rent Amount from `room.monthlyRent`, and Garbage/Electricity-Maintenance/Water-Maintenance fees from `useSettings().settings` defaults, and Electricity/Water **Previous Meter** from the room's most recent billing record's current meter if one exists (look up via a `records` prop passed down, or simplest: pass `getLatestByRoomId: (roomId: string) => BillingRecord | undefined` computed in `BillingPage`), else `0`.
- Tenant (`Select`, auto-set to the room's active assignment tenant, read-only display if present — still editable as a plain `Select` for flexibility).
- Billing Month (`Input type="month"`, required).
- Electricity: Previous Meter, Current Meter (both `Input type="number"`), Rate (`Input type="number"`) — Usage and Amount are **derived and displayed read-only** (`calculateMeterReading` recomputed on every keystroke via values in render, not stored in separate state).
- Water: same 3 inputs + derived usage/amount.
- Rent Amount (`Input type="number"`).
- Garbage Fee, Electricity Meter Maintenance Fee, Water Meter Maintenance Fee (`Input type="number"` each).
- Other Charges: a small repeatable list (`otherCharges: {name, amount}[]` local state) with "Add Charge" button (`Plus` icon) appending a blank row, each row has Name (`Input`) + Amount (`Input type="number"`) + remove (`X` icon button).
- Due Date (`Input type="date"`, optional).
- Status (`Select`: draft/issued — "paid" and "overdue" are not directly settable here; paid is only via the Invoices page's "Mark as Paid" action, overdue is display-only).
- Live summary footer inside the dialog: Subtotal and Total, computed via `calculateBillingTotals` from current form values, updating on every change (no submit needed to see the total).
On submit: build a `CreateBillingInput`, run `validateBilling`, show inline errors or call `onSubmit`, `toast.success(record ? "Billing updated" : "Billing created")`, close.

- [ ] **Step 2: `BillingTable.tsx` — desktop wide table + mobile cards**

Desktop (`hidden md:block`): `<div className="overflow-x-auto"><Table>` with columns: Room, Tenant (sticky first two columns via `className="sticky left-0 bg-background"` on their `<TableCell>`/`<TableHead>`, only really meaningful once the table is wider than viewport), Invoice #, Billing Date, Electricity Previous/Current/Usage/Rate/Amount, Water Previous/Current/Usage/Rate/Amount, Garbage Fee, Rent, Total, Status (`StatusBadge` using `resolveBillingStatus`), Actions (`DropdownMenu`: Edit / Delete / Issue [visible when draft] / Mark as Paid [visible when issued or overdue]).
Mobile (`md:hidden`): map `records` to a stacked list of `Card`s, each showing Room+Tenant+Month as the card title, Total + `StatusBadge` prominent, and a "Details" disclosure (native `<details>` or a small local `useState` toggle) revealing the electricity/water breakdown, plus the same Actions as a row of icon buttons at the card's bottom.

- [ ] **Step 3: `BillingPage.tsx`**

State: `formOpen`, `editingRecord`, `deletingRecord`. `<PageHeader title="Monthly Billing" actions={<Button onClick={openCreate}><Plus/> Create Billing</Button>} />`. Empty state (icon `Receipt`, "No billing records yet") when `records.length === 0`. Wire Issue action: `updateBilling(record.id, { status: "issued" })` then `toast.success("Invoice issued: " + result.invoiceNumber)`. Wire Mark as Paid: `updateBilling(record.id, { status: "paid" })` then `toast.success("Marked as paid")`. Delete via `ConfirmDialog` (`` `Delete this billing record for room ${roomNumber}?` ``).

- [ ] **Step 4: Verify**

Run: `pnpm build`, `pnpm dev`. Manually create a billing record for an occupied room, confirm usage/amounts/total compute correctly and match hand calculation, confirm validation blocks current meter < previous meter, confirm table renders as cards under 768px width.

- [ ] **Step 5: Mark task done**

---

### Task 13: Invoices feature — list, preview, print (Thai document)

**Files:**
- Modify: `src/features/invoices/InvoicesPage.tsx` (replace Task 6 placeholder)
- Create: `src/features/invoices/InvoicePreviewDialog.tsx`
- Create: `src/features/invoices/InvoicePrintView.tsx`
- Create: `src/features/invoices/InvoicePrintPage.tsx`
- Modify: `src/index.css` (append print media rules)

**Interfaces:**
- Consumes: `useBillingRecords`, `useRooms`, `useTenants`, `useSettings` (Task 5), `resolveBillingStatus`, `formatCurrency`, `formatThaiDate`, `formatBillingMonth` (Task 3), `useParams`/`useNavigate` (react-router).
- Produces: `<InvoicePrintView record room tenant? settings />` — the actual Thai document markup, shared by both the in-app preview dialog and the standalone print route so the two never drift apart.

- [ ] **Step 1: `InvoicePrintView.tsx` — the Thai invoice document**

Pure presentational component, `id="invoice-print-area"` on its root for print CSS targeting. Structure (values from `record`/`room`/`tenant`/`settings` props):
```
Header:  "ใบแจ้งชำระหนี้ (Invoice)"   — centered, large
         {settings.propertyName}
         {settings.propertyAddress}   {settings.phone}

Info row:  วันที่: {formatThaiDate(record.issuedAt ?? record.createdAt)}
           ผู้เช่า: {tenant ? `${tenant.firstName} ${tenant.lastName}` : "-"}
           หมายเลขห้อง: {room.roomNumber}
           (เลขที่ใบแจ้งหนี้ / Invoice No.: {record.invoiceNumber ?? "-"})

Table columns: รายการ | เลขครั้งก่อน | เลขครั้งหลัง | หน่วย | หน่วยละ | จำนวนเงิน (บาท)
Rows:
  ค่าไฟฟ้า        {electricity.previousMeter} {electricity.currentMeter} {electricity.usage} {electricity.rate} {formatCurrency(electricity.amount)}
  ค่าน้ำประปา      {water.previousMeter}       {water.currentMeter}       {water.usage}       {water.rate}       {formatCurrency(water.amount)}
  ค่าเช่ารายเดือน   —  —  —  —  {formatCurrency(record.rentAmount)}
  ค่าขยะ                                                                  {formatCurrency(record.garbageFee)}
  ค่าบำรุงรักษามิเตอร์ (ไฟฟ้า)                                              {formatCurrency(record.electricityMeterMaintenanceFee)}
  ค่าบำรุงรักษามิเตอร์ (น้ำ)                                                {formatCurrency(record.waterMeterMaintenanceFee)}
  {record.otherCharges.map(c => <row: c.name, amount: c.amount>)}         ค่าอื่น ๆ rows, one per charge

Bottom:  รวม (Total): {formatCurrency(record.total)}
         หมายเหตุ: {settings.defaultInvoiceNote}
```
Use plain semantic HTML (`<table>`, not shadcn `Table`, since this must render identically for screen preview and print, and shadcn's `Table` wrapper divs interfere with print flow less predictably than a bare `<table>` with utility classes). Styling: white background, black text, a light border grid on the table, generous padding — deliberately looks like a printable document, not the admin dashboard chrome (no shadows, no colored badges here — plain "สถานะ: {statusLabelInThai}" text line near the header instead of a `StatusBadge`, since colored UI badges don't belong on a printable invoice).

- [ ] **Step 2: `InvoicePrintPage.tsx` — standalone print route**

```tsx
import { useParams, useNavigate } from "react-router";
import { billingRepository } from "@/data/repositories/billingRepository";
import { roomRepository } from "@/data/repositories/roomRepository";
import { tenantRepository } from "@/data/repositories/tenantRepository";
import { settingsRepository } from "@/data/repositories/settingsRepository";
import { Button } from "@/components/ui/button";
import { InvoicePrintView } from "@/features/invoices/InvoicePrintView";
import { ArrowLeft, Printer } from "lucide-react";

export function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const record = id ? billingRepository.getById(id) : undefined;

  if (!record) {
    return <div className="p-6">Invoice not found. <Button variant="link" onClick={() => navigate("/invoices")}>Back to invoices</Button></div>;
  }
  const room = roomRepository.getById(record.roomId);
  const tenant = record.tenantId ? tenantRepository.getById(record.tenantId) : undefined;
  const settings = settingsRepository.get();
  if (!room) return <div className="p-6">Room not found for this invoice.</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="no-print flex items-center justify-between gap-2 border-b bg-background p-3">
        <Button variant="ghost" onClick={() => navigate("/invoices")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
      </div>
      <div className="mx-auto max-w-3xl p-4 print:p-0">
        <InvoicePrintView record={record} room={room} tenant={tenant} settings={settings} />
      </div>
    </div>
  );
}
```
Note this repository access is direct (not via a hook) because this is a standalone route with no shared layout state to synchronize — reading once on mount is correct here; if live updates while the tab is open matter later, wrap in `useBillingRecords`/`useRooms` instead, but that's not required now.

- [ ] **Step 3: Print stylesheet — append to `src/index.css`**

```css
.no-print {
  display: block;
}

@media print {
  .no-print {
    display: none !important;
  }
  @page {
    size: A4;
    margin: 10mm;
  }
  body {
    background: white;
  }
}
```

- [ ] **Step 4: `InvoicePreviewDialog.tsx` — in-app quick preview**

A `Dialog` (`className="max-h-[90vh] max-w-3xl overflow-y-auto"`) rendering the same `<InvoicePrintView />` plus a footer with "Open Full Preview / Print" (`navigate(`/invoices/${record.id}`)`) and "Mark as Paid" (when applicable) buttons — used from `InvoicesPage`'s "Preview" action so the admin doesn't always need a full page navigation just to glance at an invoice.

- [ ] **Step 5: `InvoicesPage.tsx`**

Table (reuse the desktop-table/mobile-cards pattern from Task 12's `BillingTable`, simplified to invoice-relevant columns): Invoice Number, Room, Tenant, Billing Month, Issue Date, Due Date, Amount, Status (`StatusBadge` via `resolveBillingStatus`), Actions (`DropdownMenu`: Preview → opens `InvoicePreviewDialog`; Print/Export → `navigate(`/invoices/${id}`)` then the admin clicks Print there (browser "Save as PDF" covers "Export" per spec's "no heavy PDF library" instruction — do not add a second export mechanism); Mark as Paid → same `updateBilling` call as Task 12, visible only when status is `issued`/`overdue`). Only list records where `record.invoiceNumber` is set (i.e., `status !== "draft"`) — drafts aren't invoices yet, they show up on the Billing page only, matching "Invoice Management" being about issued documents. Empty state (icon `FileText`, "No invoices yet", description "Issue a billing record to generate its first invoice").

- [ ] **Step 6: Verify**

Run: `pnpm build`, `pnpm dev`. Navigate to an issued invoice's `/invoices/:id`, confirm the Thai document renders correctly, click Print, confirm the browser print preview shows only the invoice (no header/toolbar) on an A4-sized page. Test the in-app `InvoicePreviewDialog` too.

- [ ] **Step 7: Mark task done**

---

### Task 14: Settings page

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx` (replace Task 6 placeholder)

**Interfaces:**
- Consumes: `useSettings` (Task 5).
- Produces: nothing consumed elsewhere — this is the terminal settings UI. (Rooms/Billing already read `settingsRepository`/`useSettings` directly for defaults per Tasks 9 and 12; no additional wiring needed here.)

- [ ] **Step 1: Implement the settings form**

Single `Card` with a form (no dialog — this is the one page-level form per spec's "do not navigate to a separate page for simple CRUD" being about Rooms/Tenants, not Settings, which is inherently a single full-page form): Property Name, Property Address, Phone (`Input`s), then a `Separator`, then Default Electricity Rate, Default Water Rate, Default Garbage Fee, Default Electricity Meter Maintenance Fee, Default Water Meter Maintenance Fee (`Input type="number"`), then Default Invoice Note (`Textarea`). Local state initialized from `settings`, a single "Save Settings" `Button` at the bottom calling `updateSettings(formState)` then `toast.success("Settings saved")`. No live-validation needed beyond number inputs naturally rejecting non-numeric text.

- [ ] **Step 2: Verify**

Run: `pnpm build`, `pnpm dev`. Change property name, save, reload the page, confirm it persisted (still English UI, per Task 6 decision) and that a newly created Room's default rates reflect an updated default rate.

- [ ] **Step 3: Mark task done**

---

### Task 15: Responsive polish + final verification

**Files:**
- Modify: any component from Tasks 6–14 found lacking during manual sweep (expected candidates: `AppSidebar`/`AppHeader` mobile drawer behavior, `RoomFormDialog`/`TenantFormDialog`/`BillingFormDialog` field grid collapsing to one column under `sm`, `BillingTable` mobile-card breakpoint)

**Interfaces:**
- Consumes: the whole app.
- Produces: nothing new — this task only fixes what manual testing surfaces.

- [ ] **Step 1: Manual pass at 375px**

Using browser devtools responsive mode (or resizing the window), load every route at width 375px: confirm sidebar is fully replaced by the header's drawer, no page ever scrolls horizontally as a whole (only tables/wide content scroll within their own container), every dialog/sheet is usable without off-screen content, form fields stack to one column.

- [ ] **Step 2: Manual pass at 768px and 1024px**

Confirm the sidebar appears (per Task 6's `md:flex` breakpoint — adjust the breakpoint in `AppSidebar`/`AppHeader` if 768px feels cramped with the sidebar present; `lg:flex` is an acceptable adjustment here if needed), forms use 2-column grids where there's room, `BillingTable` switches from cards to the full table at whatever breakpoint was chosen in Task 12 (confirm it's not switching too early/late).

- [ ] **Step 3: Manual pass at 1440px**

Confirm no component stretches awkwardly wide (cap page content width where it looks better, e.g. `max-w-7xl mx-auto` on `AppLayout`'s `<main>` if the dashboard cards look too sparse at full width — optional, judge by eye).

- [ ] **Step 4: Full verification**

Run in order, fixing any failure before moving to the next:
```bash
pnpm build
```
Expected: zero TypeScript errors, zero `any`, build succeeds.
```bash
pnpm lint
```
(Only if `package.json` has a `lint` script — the Vite react-ts template includes one by default.) Expected: zero errors.

- [ ] **Step 5: Dead-button sweep**

Grep for every `<Button` and `onClick`/`DropdownMenuItem` in `src/features/**` and confirm each one is wired to a real handler (no empty `() => {}`, no missing handler). Confirm every action mentioned in the original requirements exists and works: Add/Edit/Delete/View for Rooms and Tenants, Assign/End Tenancy/Move Room, Create/Edit/Delete/Issue/Mark-as-Paid for Billing, Preview/Print/Mark-as-Paid for Invoices, Save for Settings, all 4 Dashboard quick actions.

- [ ] **Step 6: Mark task done**

---

### Task 16: README.md and context.md

**Files:**
- Modify: `README.md`
- Create: `context.md`

**Interfaces:**
- Consumes: final state of the whole app (write these last, after Task 15).
- Produces: nothing — terminal documentation task.

- [ ] **Step 1: Update `README.md`**

Keep the existing overview/features/tech-stack framing already in the repo's `README.md`, add: Installation (`pnpm install`), Development (`pnpm dev`), Build (`pnpm build`), Lint (`pnpm lint` if present), a "Project Structure" section (short tree, top 2 levels), a "Demo Data" section explaining seeding is automatic and idempotent (clearing `localStorage` re-seeds), and a "Current Limitations" section (no backend/auth/multi-property/PDF export beyond browser print — matches spec section on Known Limitations).

- [ ] **Step 2: Write `context.md`**

Cover exactly the sections required by the original requirements doc: Project Overview, Current Tech Stack (with versions read from the final `package.json`), Architecture (navigation/feature organization/state strategy/repository architecture/localStorage usage — summarize Design Spec sections 3–4), Domain Model (all 6 types with their relations, note `invoiceNumber` lives on `BillingRecord`), Business Rules (copy the bullet list from the Design Spec section 4, since that's what got implemented), Feature Status table (all features from Tasks 8–14, status "Done" for everything actually working after Task 15's verification, "Partial"/"Not Started" for anything cut), Storage Keys (`rental.rooms`, `rental.tenants`, `rental.assignments`, `rental.billing`, `rental.settings` — matches `STORAGE_KEYS` in Task 4), Important Files (short table: path → responsibility, covering the repositories/hooks/lib files), Known Limitations (frontend-only, no auth, no multi-property, no real PDF backend, localStorage only, English-only UI for now), Future Improvements (Firebase Auth/Firestore/Storage, multi-property, payment tracking, cloud invoice PDFs, automated recurring billing, notifications, bilingual UI — per the user's stated future direction), Development Guidelines (read `context.md` first, preserve strict mode, keep calculations in `lib/`, keep storage behind repositories, update `context.md` after architecture/feature changes, don't replace this architecture without documenting why).

- [ ] **Step 3: Mark task done — implementation complete**

---

## Self-Review Notes

- **Spec coverage:** every numbered section (1 Dashboard, 2 Rooms, 3 Tenants, 4 Assignment, 5 Room Detail, 6 Monthly Billing, 7 Billing Table, 8 Invoices, 9 Invoice Number, 9 Invoice Preview, 10 Print, 11 Settings, Storage Architecture, Folder Structure, Utilities, Validation, Delete Behavior, Empty States, Responsive, context.md, README) maps to Tasks 1–16 above.
- **Deliberate deviation from strict TDD test-first steps:** the spec's own Verification section only requires `pnpm build`/`pnpm lint` — no test framework was requested, so "tests" in this plan are manual verification steps against the running app rather than automated unit tests, per Global Constraints.
- **Type consistency checked:** `Room`/`Tenant`/`RoomTenantAssignment`/`BillingRecord`/`PropertySettings` field names are identical everywhere they're referenced across Tasks 4/5/9/10/11/12/13/14. Hook return shapes (`{ rooms, createRoom, updateRoom, deleteRoom, refresh }` etc.) are consistent between Task 5's definitions and every later task's usage.
