# Other Charge Master + Default Billing Settings Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `PropertySettings`'s three fixed fee defaults (garbage, electricity meter maintenance, water meter maintenance) out into a new, reusable, optional "Other Charge Master" that a user explicitly attaches per bill — while `PropertySettings` keeps only the true always-on defaults (electricity rate, water rate, invoice note).

**Architecture:** Add a new `otherChargeRepository`/`useOtherCharges` pair (same shape as every other repository/hook in this app) backing a new `rental.otherCharges` storage key. Trim `PropertySettings`/`BillingRecord` to drop the three scalar fee fields, since `BillingRecord.otherCharges: BillingCharge[]` (already existing) becomes the sole vehicle for every optional charge, with a new optional `masterId` linking a charge back to its master record. A one-time idempotent migration seeds 7 example master rows and rewrites any pre-existing `BillingRecord`'s legacy scalar fees into `otherCharges` entries.

**Tech Stack:** Vite 8, React 19, TypeScript ~6.0 (strict), Tailwind v4, hand-authored Radix/shadcn-style primitives in `src/components/ui/`, `react-router`, `lucide-react`, `sonner`, custom i18n (`src/i18n/*`), `pnpm`, `oxlint`.

## Global Constraints

- TypeScript strict mode stays on; never introduce `any`.
- `localStorage` is only ever touched through `src/data/repositories/*` (or the one migration module added here, which is part of the data layer) — never from components or hooks.
- Every user-facing string goes through `t("...")`; a new key must be added to `Translations` (`src/i18n/types.ts`) and **both** `src/i18n/translations/en.ts` and `th.ts` in the same change (TypeScript strict mode makes a mismatch a compile error).
- `src/lib/validation.ts` never imports from `src/i18n/` — validators return translation *keys*, not literal strings.
- Billing/settings math stays in `src/lib/calculations.ts`, never inline in a component.
- **This repo has no test runner** (`package.json` scripts are only `dev`/`build`/`lint`/`preview` — no `vitest`/`jest`, no `*.test.*` files anywhere). Do not add one as part of this plan; it is out of scope. Every task's verification step is therefore `pnpm build` (runs `tsc -b && vite build` — this is the type-check gate) plus, where noted, a manual check via `pnpm dev` in a browser and/or `pnpm lint` (`oxlint`). This mirrors the project's own established verification convention (see `context.md`'s Development Guidelines).
- Because `pnpm build` type-checks the whole program at once, a few tasks in the middle of this plan are large (touching many files together) rather than maximally bite-sized — this is called out explicitly in those tasks. Splitting a single TypeScript interface change from the call sites it breaks would leave an unreviewable red build in between, so those changes are kept as one task by design.
- Per this project's own stored working convention: **do not run `git commit`.** Each task's last step is "stage the change" (`git add`), not commit — the user commits themselves.
- Design doc for this work: `docs/superpowers/specs/2026-08-10-billing-other-charges-design.md` — read it first for the full rationale; this plan implements it task-by-task.

---

## File Structure

New files:
- `src/types/otherCharge.ts` — `OtherChargeMaster`, `CreateOtherChargeInput`, `UpdateOtherChargeInput`.
- `src/data/repositories/otherChargeRepository.ts` — CRUD against `rental.otherCharges`.
- `src/hooks/useOtherCharges.ts` — thin state wrapper, same shape as `useRooms`.
- `src/data/migrations/legacyChargeMigration.ts` — one-time idempotent seed + legacy-record migration.
- `src/features/settings/OtherChargeFormDialog.tsx` — add/edit dialog for one master charge.
- `src/features/settings/OtherChargeTable.tsx` — master-data table (name / default amount / status / actions).
- `src/features/settings/OtherChargeSection.tsx` — orchestrates the hook + table + dialogs for the Settings page.

Modified files (grouped by task below): `src/types/settings.ts`, `src/types/billing.ts`, `src/lib/calculations.ts`, `src/data/repositories/settingsRepository.ts`, `src/data/repositories/billingRepository.ts`, `src/data/seed/seedData.ts`, `src/main.tsx`, `src/features/settings/SettingsPage.tsx`, `src/features/billing/BillingFormDialog.tsx`, `src/features/billing/BillingPage.tsx`, `src/features/billing/BillingTable.tsx`, `src/features/invoices/InvoicePrintView.tsx`, `src/i18n/types.ts`, `src/i18n/translations/en.ts`, `src/i18n/translations/th.ts`, `src/lib/validation.ts`.

---

### Task 1: Other Charge Master data layer (types, storage key, repository, hook)

Purely additive — nothing existing changes, so the build stays green throughout. This is the foundation every later task builds on.

**Files:**
- Create: `src/types/otherCharge.ts`
- Modify: `src/data/storage/storage.ts`
- Create: `src/data/repositories/otherChargeRepository.ts`
- Create: `src/hooks/useOtherCharges.ts`

**Interfaces:**
- Produces: `OtherChargeMaster { id, nameTh, nameEn?, defaultAmount, isActive, createdAt, updatedAt }`; `CreateOtherChargeInput = Omit<OtherChargeMaster, "id"|"createdAt"|"updatedAt">`; `UpdateOtherChargeInput = Partial<CreateOtherChargeInput>`; `otherChargeRepository.{getAll, getActive, getById, create, update, delete}`; `useOtherCharges()` returning `{ otherCharges, refresh, createOtherCharge, updateOtherCharge, deleteOtherCharge }`; `STORAGE_KEYS.otherCharges === "otherCharges"`.

- [ ] **Step 1: Create the type file**

`src/types/otherCharge.ts`:

```ts
export interface OtherChargeMaster {
  id: string;
  nameTh: string;
  nameEn?: string;
  defaultAmount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateOtherChargeInput = Omit<OtherChargeMaster, "id" | "createdAt" | "updatedAt">;
export type UpdateOtherChargeInput = Partial<CreateOtherChargeInput>;
```

- [ ] **Step 2: Add the storage key**

Modify `src/data/storage/storage.ts` — add one line to the existing `STORAGE_KEYS` object (do not touch anything else in the file):

```ts
export const STORAGE_KEYS = {
  rooms: "rooms",
  tenants: "tenants",
  assignments: "assignments",
  billing: "billing",
  settings: "settings",
  otherCharges: "otherCharges",
} as const;
```

- [ ] **Step 3: Create the repository**

`src/data/repositories/otherChargeRepository.ts` — same shape as `src/data/repositories/roomRepository.ts`:

```ts
import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import type { OtherChargeMaster, CreateOtherChargeInput, UpdateOtherChargeInput } from "@/types/otherCharge";

function all(): OtherChargeMaster[] {
  return readCollection<OtherChargeMaster>(STORAGE_KEYS.otherCharges);
}

export const otherChargeRepository = {
  getAll(): OtherChargeMaster[] {
    return all();
  },
  getActive(): OtherChargeMaster[] {
    return all().filter((c) => c.isActive);
  },
  getById(id: string): OtherChargeMaster | undefined {
    return all().find((c) => c.id === id);
  },
  create(input: CreateOtherChargeInput): OtherChargeMaster {
    const now = new Date().toISOString();
    const charge: OtherChargeMaster = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    writeCollection(STORAGE_KEYS.otherCharges, [...all(), charge]);
    return charge;
  },
  update(id: string, input: UpdateOtherChargeInput): OtherChargeMaster {
    const charges = all();
    const index = charges.findIndex((c) => c.id === id);
    if (index === -1) throw new Error(`Other charge ${id} not found`);
    const updated: OtherChargeMaster = { ...charges[index], ...input, updatedAt: new Date().toISOString() };
    charges[index] = updated;
    writeCollection(STORAGE_KEYS.otherCharges, charges);
    return updated;
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.otherCharges, all().filter((c) => c.id !== id));
  },
};
```

- [ ] **Step 4: Create the hook**

`src/hooks/useOtherCharges.ts` — same shape as `src/hooks/useRooms.ts`:

```ts
import { useCallback, useState } from "react";
import { otherChargeRepository } from "@/data/repositories/otherChargeRepository";
import type { OtherChargeMaster, CreateOtherChargeInput, UpdateOtherChargeInput } from "@/types/otherCharge";

export function useOtherCharges() {
  const [otherCharges, setOtherCharges] = useState<OtherChargeMaster[]>(() => otherChargeRepository.getAll());

  const refresh = useCallback(() => setOtherCharges(otherChargeRepository.getAll()), []);

  const createOtherCharge = useCallback(
    (input: CreateOtherChargeInput) => {
      const charge = otherChargeRepository.create(input);
      refresh();
      return charge;
    },
    [refresh]
  );

  const updateOtherCharge = useCallback(
    (id: string, input: UpdateOtherChargeInput) => {
      const charge = otherChargeRepository.update(id, input);
      refresh();
      return charge;
    },
    [refresh]
  );

  const deleteOtherCharge = useCallback(
    (id: string) => {
      otherChargeRepository.delete(id);
      refresh();
    },
    [refresh]
  );

  return { otherCharges, refresh, createOtherCharge, updateOtherCharge, deleteOtherCharge };
}
```

- [ ] **Step 5: Verify the build**

Run: `pnpm build`
Expected: no errors (this task added code but nothing existing imports it yet, so nothing can break).

- [ ] **Step 6: Stage the change**

```bash
git add src/types/otherCharge.ts src/data/storage/storage.ts src/data/repositories/otherChargeRepository.ts src/hooks/useOtherCharges.ts
```

Do not run `git commit` — leave it staged for the user to commit.

---

### Task 2: Trim the data model (settings + billing types, calculations, both repositories, and every direct consumer)

**This task is intentionally large.** `pnpm build` type-checks the whole program in one pass, so removing `garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee` from the type layer and fixing every place that references those fields has to land together — a partial version would leave the build red with no task boundary to "approve" in between. Ten files change in this task; none of them add new user-facing behavior yet (the new charge-picker UI is Task 6) — this task only removes the old fixed-fee fields/inputs cleanly so the app keeps building and behaving the same for every *other* field.

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/types/billing.ts`
- Modify: `src/lib/calculations.ts`
- Modify: `src/data/repositories/settingsRepository.ts`
- Modify: `src/data/repositories/billingRepository.ts`
- Modify: `src/data/seed/seedData.ts`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/billing/BillingFormDialog.tsx`
- Modify: `src/features/billing/BillingTable.tsx`
- Modify: `src/features/invoices/InvoicePrintView.tsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `PropertySettings { propertyName, propertyAddress, phone, defaultElectricityRate, defaultWaterRate, defaultInvoiceNote }` (3 fee fields removed); `BillingCharge { id, masterId?, name, amount }`; `BillingRecord`/`CreateBillingInput`/`UpdateBillingInput` without `garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee`; `calculateBillingTotals(params: { electricityAmount: number; waterAmount: number; rentAmount: number; otherCharges: Pick<BillingCharge, "amount">[] }): BillingTotals`. Task 4 (migration) and Task 6 (billing form charge picker) both build on these exact shapes.

- [ ] **Step 1: Trim `PropertySettings`**

Replace the full contents of `src/types/settings.ts`:

```ts
export interface PropertySettings {
  propertyName: string;
  propertyAddress: string;
  phone: string;
  defaultElectricityRate: number;
  defaultWaterRate: number;
  defaultInvoiceNote: string;
}
```

- [ ] **Step 2: Trim `BillingRecord`/`BillingCharge`/`CreateBillingInput`/`UpdateBillingInput`**

Replace the full contents of `src/types/billing.ts`:

```ts
export type BillingStatus = "draft" | "issued" | "paid" | "overdue";

export interface BillingCharge {
  id: string;
  masterId?: string;
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
  otherCharges: Omit<BillingCharge, "id">[];
  dueDate?: string;
  status?: BillingStatus;
}

export type UpdateBillingInput = Partial<CreateBillingInput> & { status?: BillingStatus };
```

- [ ] **Step 3: Simplify `calculateBillingTotals`**

Modify `src/lib/calculations.ts` — replace the `calculateBillingTotals` function (keep `calculateUsage`/`calculateMeterReading`/`BillingTotals` untouched):

```ts
export function calculateBillingTotals(params: {
  electricityAmount: number;
  waterAmount: number;
  rentAmount: number;
  otherCharges: Pick<BillingCharge, "amount">[];
}): BillingTotals {
  const subtotal = params.electricityAmount + params.waterAmount + params.rentAmount;
  const otherTotal = params.otherCharges.reduce((sum, c) => sum + c.amount, 0);
  return { subtotal, total: subtotal + otherTotal };
}
```

- [ ] **Step 4: Trim `settingsRepository` defaults**

Replace the full contents of `src/data/repositories/settingsRepository.ts`:

```ts
import { readValue, writeValue, STORAGE_KEYS } from "@/data/storage/storage";
import type { PropertySettings } from "@/types/settings";

const DEFAULTS: PropertySettings = {
  propertyName: "Sunrise Apartments",
  propertyAddress: "",
  phone: "",
  defaultElectricityRate: 8,
  defaultWaterRate: 18,
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

- [ ] **Step 5: Update `billingRepository` to match**

Replace the full contents of `src/data/repositories/billingRepository.ts`:

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
      otherCharges: input.otherCharges ?? existing.otherCharges,
      dueDate: input.dueDate ?? existing.dueDate,
      status: input.status ?? existing.status,
    };
    const recomputed = computeRecord(merged, existing.id, existing.createdAt);
    const wasIssuedNow = existing.status !== "issued" && recomputed.status === "issued";
    const updated: BillingRecord = {
      ...recomputed,
      invoiceNumber: wasIssuedNow
        ? generateInvoiceNumber(merged.billingMonth, all().filter((b) => b.id !== id))
        : (existing.invoiceNumber ?? recomputed.invoiceNumber),
      issuedAt: wasIssuedNow ? new Date().toISOString() : existing.issuedAt,
      paidAt: recomputed.status === "paid" ? (existing.paidAt ?? new Date().toISOString()) : existing.paidAt,
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

(The only change from the current file: `computeRecord` no longer reads/writes `garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee`, and `calculateBillingTotals` is called with the trimmed params.)

- [ ] **Step 6: Fix seed data**

Modify `src/data/seed/seedData.ts` — in each of the 4 `billingRepository.create({...})` calls, delete the `garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30,` segment. For example, the first call:

```ts
  billingRepository.create({
    roomId: rooms[1].id, tenantId: tenants[0].id, billingMonth: "2026-06",
    electricityPreviousMeter: 1200, electricityCurrentMeter: 1340, electricityRate: 8,
    waterPreviousMeter: 300, waterCurrentMeter: 320, waterRate: 18,
    rentAmount: 4500,
    otherCharges: [], dueDate: "2026-07-05", status: "paid",
  });
```

Apply the same removal to the other 3 calls (lines currently ~46-52, ~53-59, ~60-66 per the pre-change file), keeping every other field (including the third record's `otherCharges: [{ name: "Parking", amount: 300 }]`) unchanged.

- [ ] **Step 7: Trim `SettingsPage.tsx`**

Modify `src/features/settings/SettingsPage.tsx`. First, `toFormState` — remove the 3 fee lines:

```ts
function toFormState(settings: PropertySettings) {
  return {
    propertyName: settings.propertyName,
    propertyAddress: settings.propertyAddress,
    phone: settings.phone,
    defaultElectricityRate: String(settings.defaultElectricityRate),
    defaultWaterRate: String(settings.defaultWaterRate),
    defaultInvoiceNote: settings.defaultInvoiceNote,
  };
}
```

Then `handleSave` — remove the 3 fee lines:

```ts
  function handleSave() {
    updateSettings({
      propertyName: form.propertyName.trim(),
      propertyAddress: form.propertyAddress.trim(),
      phone: form.phone.trim(),
      defaultElectricityRate: Number(form.defaultElectricityRate) || 0,
      defaultWaterRate: Number(form.defaultWaterRate) || 0,
      defaultInvoiceNote: form.defaultInvoiceNote.trim(),
    });
    toast.success(t("settings.savedToast"));
  }
```

Then, inside the "Default Billing Rates" `Card`'s `CardContent`, delete the 3 fee `<div className="space-y-1.5">` blocks (`defaultGarbageFee`, the `<div />` spacer next to it, `defaultElectricityMeterMaintenanceFee`, `defaultWaterMeterMaintenanceFee`) so the grid only contains the electricity-rate and water-rate fields, followed directly by the existing `<Separator />` and invoice-note field:

```tsx
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="defaultElectricityRate">
                {t("settings.defaultElectricityRate")}
              </Label>
              <Input
                id="defaultElectricityRate"
                type="number"
                min={0}
                value={form.defaultElectricityRate}
                onChange={(e) =>
                  setForm({ ...form, defaultElectricityRate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultWaterRate">
                {t("settings.defaultWaterRate")}
              </Label>
              <Input
                id="defaultWaterRate"
                type="number"
                min={0}
                value={form.defaultWaterRate}
                onChange={(e) =>
                  setForm({ ...form, defaultWaterRate: e.target.value })
                }
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="defaultInvoiceNote">
              {t("settings.defaultInvoiceNote")}
            </Label>
            <Textarea
              id="defaultInvoiceNote"
              value={form.defaultInvoiceNote}
              onChange={(e) =>
                setForm({ ...form, defaultInvoiceNote: e.target.value })
              }
            />
          </div>
        </CardContent>
```

Leave the Property Information card and the Theme card completely untouched (this task does not add the Other Charge Master card yet — that's Task 5).

- [ ] **Step 8: Trim `BillingFormDialog.tsx`'s fixed-fee fields**

Modify `src/features/billing/BillingFormDialog.tsx`. In `FormState`, remove the 3 fee lines:

```ts
interface FormState {
  roomId: string;
  tenantId: string;
  billingMonth: string;
  electricityPreviousMeter: string;
  electricityCurrentMeter: string;
  electricityRate: string;
  waterPreviousMeter: string;
  waterCurrentMeter: string;
  waterRate: string;
  rentAmount: string;
  dueDate: string;
  status: "draft" | "issued";
  otherCharges: ChargeRow[];
}
```

In `buildFormState`, remove the 3 fee lines from both the `record` branch and the new-record branch:

```ts
  if (record) {
    return {
      roomId: record.roomId,
      tenantId: record.tenantId ?? "",
      billingMonth: record.billingMonth,
      electricityPreviousMeter: String(record.electricity.previousMeter),
      electricityCurrentMeter: String(record.electricity.currentMeter),
      electricityRate: String(record.electricity.rate),
      waterPreviousMeter: String(record.water.previousMeter),
      waterCurrentMeter: String(record.water.currentMeter),
      waterRate: String(record.water.rate),
      rentAmount: String(record.rentAmount),
      dueDate: record.dueDate ?? "",
      status: record.status === "issued" ? "issued" : "draft",
      otherCharges: chargesToRows(record.otherCharges),
    };
  }
  return {
    roomId: room?.id ?? "",
    tenantId: tenantId ?? "",
    billingMonth: currentMonth(),
    electricityPreviousMeter: latest ? String(latest.electricity.currentMeter) : "0",
    electricityCurrentMeter: "0",
    electricityRate: room ? String(room.electricityRate) : String(settings.defaultElectricityRate),
    waterPreviousMeter: latest ? String(latest.water.currentMeter) : "0",
    waterCurrentMeter: "0",
    waterRate: room ? String(room.waterRate) : String(settings.defaultWaterRate),
    rentAmount: room ? String(room.monthlyRent) : "0",
    dueDate: "",
    status: "draft",
    otherCharges: [],
  };
```

In the totals-preview block, drop the 3 fee params from the `calculateBillingTotals` call:

```ts
  const totals = calculateBillingTotals({
    electricityAmount: electricityPreview.amount,
    waterAmount: waterPreview.amount,
    rentAmount: Number(form.rentAmount) || 0,
    otherCharges: chargesPreview,
  });
```

In `handleSubmit`, drop the 3 fee lines from the built `input`:

```ts
    const input: CreateBillingInput = {
      roomId: form.roomId,
      tenantId: form.tenantId || undefined,
      billingMonth: form.billingMonth,
      electricityPreviousMeter: Number(form.electricityPreviousMeter) || 0,
      electricityCurrentMeter: Number(form.electricityCurrentMeter) || 0,
      electricityRate: Number(form.electricityRate) || 0,
      waterPreviousMeter: Number(form.waterPreviousMeter) || 0,
      waterCurrentMeter: Number(form.waterCurrentMeter) || 0,
      waterRate: Number(form.waterRate) || 0,
      rentAmount: Number(form.rentAmount) || 0,
      otherCharges: form.otherCharges
        .filter((c) => c.name.trim() !== "")
        .map((c) => ({ name: c.name.trim(), amount: Number(c.amount) || 0 })),
      dueDate: form.dueDate || undefined,
      status: form.status,
    };
```

Finally, in the JSX, delete the `garbage-fee`, `elec-maint-fee`, and `water-maint-fee` `<div className="space-y-1.5">` blocks from the rent/due-date/status grid, leaving just `rent`, `due-date`, and `status`:

```tsx
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rent">{t("billing.rentAmount")}</Label>
              <Input id="rent" type="number" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} />
              {errors.rentAmount && <p className="text-xs text-destructive">{t(errors.rentAmount)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due-date">{t("common.dueDate")}</Label>
              <Input id="due-date" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">{t("common.status")}</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as "draft" | "issued" })}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("status.draft")}</SelectItem>
                  <SelectItem value="issued">{t("status.issued")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
```

Leave the "otherCharges" section (the `billing.otherCharges` heading, `addCharge` button, and the mapped rows) exactly as-is for now — Task 6 replaces it with the master-charge picker. This task must still compile with the old manual-entry-only otherCharges UI in place; it does not reference any of the 3 removed fields, so it needs no change here.

- [ ] **Step 9: Trim `BillingTable.tsx`**

Modify `src/features/billing/BillingTable.tsx`. Remove the desktop table's garbage-fee column — delete this header:

```tsx
              <TableHead>{t("billing.garbageFee")}</TableHead>
```

and delete this cell:

```tsx
                  <TableCell>{formatCurrency(record.garbageFee, language)}</TableCell>
```

(both currently sit between the water-amount and rent columns/cells — remove them, keep everything else in that row in the same order).

Remove the mobile card's garbage-fee detail line:

```tsx
            <p>{t("billing.garbageDetailLine", { amount: formatCurrency(record.garbageFee, language) })}</p>
```

Nothing replaces either removal — `record.total` (already shown in both the table and the card) already reflects every charge including `otherCharges`.

- [ ] **Step 10: Trim and reorder `InvoicePrintView.tsx`**

Modify `src/features/invoices/InvoicePrintView.tsx`. Replace the `<tbody>` block so rent comes before electricity/water (per the design doc's required invoice order: rent → electricity → water → other charges) and the 3 hardcoded fee rows are gone:

```tsx
        <tbody>
          <tr className="border-b">
            <td className="py-1.5">{t("invoice.rentItem")}</td>
            <td className="py-1.5 text-right">—</td>
            <td className="py-1.5 text-right">—</td>
            <td className="py-1.5 text-right">—</td>
            <td className="py-1.5 text-right">—</td>
            <td className="py-1.5 text-right">{record.rentAmount.toFixed(2)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1.5">{t("invoice.electricityItem")}</td>
            <td className="py-1.5 text-right">{record.electricity.previousMeter}</td>
            <td className="py-1.5 text-right">{record.electricity.currentMeter}</td>
            <td className="py-1.5 text-right">{record.electricity.usage}</td>
            <td className="py-1.5 text-right">{record.electricity.rate.toFixed(2)}</td>
            <td className="py-1.5 text-right">{record.electricity.amount.toFixed(2)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1.5">{t("invoice.waterItem")}</td>
            <td className="py-1.5 text-right">{record.water.previousMeter}</td>
            <td className="py-1.5 text-right">{record.water.currentMeter}</td>
            <td className="py-1.5 text-right">{record.water.usage}</td>
            <td className="py-1.5 text-right">{record.water.rate.toFixed(2)}</td>
            <td className="py-1.5 text-right">{record.water.amount.toFixed(2)}</td>
          </tr>
          {record.otherCharges.map((charge) => (
            <tr key={charge.id} className="border-b">
              <td className="py-1.5">{t("invoice.otherChargeItem", { name: charge.name })}</td>
              <td className="py-1.5 text-right">—</td>
              <td className="py-1.5 text-right">—</td>
              <td className="py-1.5 text-right">—</td>
              <td className="py-1.5 text-right">—</td>
              <td className="py-1.5 text-right">{charge.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
```

- [ ] **Step 11: Verify the build**

Run: `pnpm build`
Expected: no errors. If any remain, they will name a file/line still referencing `garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee`/`defaultGarbageFee`/`defaultElectricityMeterMaintenanceFee`/`defaultWaterMeterMaintenanceFee` — every such reference was enumerated in the design doc's grep (10 files, all covered by Steps 1-10 above); double-check you didn't skip one.

- [ ] **Step 12: Manual smoke check**

Run: `pnpm dev`, open the app, log in with the demo credentials, and confirm: Settings page loads without errors and shows only the 2 rate fields + note; Billing page's table and cards render without errors; opening "Create Billing" and "Edit" on an existing record opens without errors; the Invoices preview for an existing record renders without errors (rent/electricity/water rows only, no maintenance-fee rows, no crash from the removed fields). This is expected to still work exactly as before except for the missing fee UI/rows — full new-UI behavior lands in Tasks 5-6.

- [ ] **Step 13: Stage the change**

```bash
git add src/types/settings.ts src/types/billing.ts src/lib/calculations.ts src/data/repositories/settingsRepository.ts src/data/repositories/billingRepository.ts src/data/seed/seedData.ts src/features/settings/SettingsPage.tsx src/features/billing/BillingFormDialog.tsx src/features/billing/BillingTable.tsx src/features/invoices/InvoicePrintView.tsx
```

Do not run `git commit`.

---

### Task 3: i18n — remove dead keys, add new ones, add `validateOtherCharge`

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations/en.ts`
- Modify: `src/i18n/translations/th.ts`
- Modify: `src/lib/validation.ts`

**Interfaces:**
- Consumes: nothing new from Tasks 1-2 directly, but depends on Task 2 having already removed every reference to the keys being deleted here (otherwise deleting them would break the build).
- Produces: new flat keys under `settings.*` and `billing.*` (listed below), a new nested `validation.otherCharge.{nameThRequired, defaultAmountNegative}`, and `validateOtherCharge(input: { nameTh?: string; defaultAmount?: number }): ValidationErrors` — Task 5 (Settings UI) and Task 6 (Billing form UI) both consume these keys and this function by exact name.

- [ ] **Step 1: Remove dead keys and add new ones in `src/i18n/types.ts`**

In the `billing` block, delete these 4 lines:

```ts
    garbageFee: string;
    electricityMaintenanceFee: string;
    waterMaintenanceFee: string;
```
```ts
    garbageDetailLine: string;
```

(`garbageFee`/`electricityMaintenanceFee`/`waterMaintenanceFee` currently sit right after `rentAmount`; `garbageDetailLine` sits between `rentDetailLine` and `otherChargeDetailLine`.)

Add these 4 lines to the `billing` block, right after `chargeAmountPlaceholder`:

```ts
    otherChargesSelectPlaceholder: string;
    otherChargesAdd: string;
    otherChargesNoneAvailable: string;
    otherChargesRemove: string;
```

In the `invoice` block, delete these 3 lines:

```ts
    garbageItem: string;
    electricityMaintenanceItem: string;
    waterMaintenanceItem: string;
```

In the `settings` block, delete these 3 lines:

```ts
    defaultGarbageFee: string;
    electricityMaintenanceFee: string;
    waterMaintenanceFee: string;
```

Add these 18 lines to the `settings` block, right after `defaultInvoiceNote` and before `save` (deliberately no `otherChargesStatus`/`otherChargesActive`/`otherChargesInactive` — the Other Charge Master's active/inactive display reuses the existing `StatusBadge` component with `status="active"`/`status="inactive"`, which already resolves through the existing `status.active`/`status.inactive` keys; see Task 5):

```ts
    otherChargesTitle: string;
    otherChargesAdd: string;
    otherChargesEdit: string;
    otherChargesNameTh: string;
    otherChargesNameEn: string;
    otherChargesDefaultAmount: string;
    otherChargesNamePlaceholder: string;
    otherChargesNameEnPlaceholder: string;
    otherChargesAmountPlaceholder: string;
    otherChargesNoChargesTitle: string;
    otherChargesNoChargesDescription: string;
    otherChargesSavedToast: string;
    otherChargesUpdatedToast: string;
    otherChargesDeletedToast: string;
    otherChargesActivatedToast: string;
    otherChargesDeactivatedToast: string;
    otherChargesDeleteConfirmTitle: string;
    otherChargesDeleteConfirmDescription: string;
```

In the `validation` block, add a new nested object after `billing`:

```ts
    otherCharge: {
      nameThRequired: string;
      defaultAmountNegative: string;
    };
```

- [ ] **Step 2: Mirror the same structure in `src/i18n/translations/en.ts`**

In the `billing` object: delete the `garbageFee`/`electricityMaintenanceFee`/`waterMaintenanceFee` lines (right after `rentAmount`) and the `garbageDetailLine` line (right after `rentDetailLine`). Change `addCharge`'s value to reflect its new sole purpose (the custom-charge button) and add the 4 new keys right after `chargeAmountPlaceholder`:

```ts
    rentAmount: "Rent Amount",
    otherCharges: "Other Charges",
    addCharge: "Add Custom Charge",
    chargeNamePlaceholder: "Charge name",
    chargeAmountPlaceholder: "Amount",
    otherChargesSelectPlaceholder: "Select a charge",
    otherChargesAdd: "Add",
    otherChargesNoneAvailable: "No more charges available to add",
    otherChargesRemove: "Remove charge",
```

And:

```ts
    rentDetailLine: "Rent: {{amount}}",
    otherChargeDetailLine: "{{name}}: {{amount}}",
```

In the `invoice` object, delete the `garbageItem`/`electricityMaintenanceItem`/`waterMaintenanceItem` lines (between `rentItem` and `otherChargeItem`).

In the `settings` object, delete `defaultGarbageFee`/`electricityMaintenanceFee`/`waterMaintenanceFee` (between `defaultWaterRate` and `defaultInvoiceNote`) and add the 18 new keys right after `defaultInvoiceNote`:

```ts
    defaultInvoiceNote: "Default Invoice Note",
    otherChargesTitle: "Other Charge Master",
    otherChargesAdd: "Add Charge",
    otherChargesEdit: "Edit Charge",
    otherChargesNameTh: "Name (Thai)",
    otherChargesNameEn: "Name (English)",
    otherChargesDefaultAmount: "Default Amount",
    otherChargesNamePlaceholder: "e.g. Parking Fee",
    otherChargesNameEnPlaceholder: "e.g. Parking Fee (optional)",
    otherChargesAmountPlaceholder: "0",
    otherChargesNoChargesTitle: "No other charges yet",
    otherChargesNoChargesDescription: "Add your first charge to make it available when creating a monthly bill.",
    otherChargesSavedToast: "Charge created",
    otherChargesUpdatedToast: "Charge updated",
    otherChargesDeletedToast: "Charge deleted",
    otherChargesActivatedToast: "Charge activated",
    otherChargesDeactivatedToast: "Charge deactivated",
    otherChargesDeleteConfirmTitle: "Delete charge {{name}}?",
    otherChargesDeleteConfirmDescription: "This will permanently remove the charge from the master list. Bills that already used it are not affected.",
    save: "Save Settings",
```

In the `validation` object, add after `billing`:

```ts
    otherCharge: {
      nameThRequired: "Thai name is required",
      defaultAmountNegative: "Default amount cannot be negative",
    },
```

- [ ] **Step 3: Mirror the same structure in `src/i18n/translations/th.ts`**

Same deletions/additions as Step 2, Thai text:

```ts
    rentAmount: "ค่าเช่า",
    otherCharges: "ค่าใช้จ่ายอื่น ๆ",
    addCharge: "เพิ่มรายการเอง",
    chargeNamePlaceholder: "ชื่อรายการ",
    chargeAmountPlaceholder: "จำนวนเงิน",
    otherChargesSelectPlaceholder: "เลือกค่าใช้จ่าย",
    otherChargesAdd: "เพิ่ม",
    otherChargesNoneAvailable: "ไม่มีค่าใช้จ่ายให้เลือกเพิ่มแล้ว",
    otherChargesRemove: "ลบรายการ",
```

```ts
    rentDetailLine: "ค่าเช่า: {{amount}}",
    otherChargeDetailLine: "{{name}}: {{amount}}",
```

Delete `garbageItem`/`electricityMaintenanceItem`/`waterMaintenanceItem` from `invoice`.

```ts
    defaultInvoiceNote: "หมายเหตุเริ่มต้นในใบแจ้งหนี้",
    otherChargesTitle: "ค่าใช้จ่ายอื่น ๆ",
    otherChargesAdd: "เพิ่มรายการ",
    otherChargesEdit: "แก้ไขรายการ",
    otherChargesNameTh: "ชื่อรายการ (ไทย)",
    otherChargesNameEn: "ชื่อรายการ (อังกฤษ)",
    otherChargesDefaultAmount: "จำนวนเงินเริ่มต้น",
    otherChargesNamePlaceholder: "เช่น ค่าที่จอดรถ",
    otherChargesNameEnPlaceholder: "เช่น Parking Fee (ไม่บังคับ)",
    otherChargesAmountPlaceholder: "0",
    otherChargesNoChargesTitle: "ยังไม่มีรายการค่าใช้จ่ายอื่น",
    otherChargesNoChargesDescription: "เพิ่มรายการค่าใช้จ่ายแรกของคุณเพื่อเลือกใช้ในบิลรายเดือน",
    otherChargesSavedToast: "บันทึกรายการเรียบร้อยแล้ว",
    otherChargesUpdatedToast: "อัปเดตรายการเรียบร้อยแล้ว",
    otherChargesDeletedToast: "ลบรายการเรียบร้อยแล้ว",
    otherChargesActivatedToast: "เปิดใช้งานรายการแล้ว",
    otherChargesDeactivatedToast: "ปิดใช้งานรายการแล้ว",
    otherChargesDeleteConfirmTitle: "ต้องการลบรายการ {{name}} หรือไม่?",
    otherChargesDeleteConfirmDescription: "การดำเนินการนี้จะลบรายการค่าใช้จ่ายนี้จากรายการหลักอย่างถาวร บิลที่เคยออกไปแล้วจะไม่ได้รับผลกระทบ",
    save: "บันทึกการตั้งค่า",
```

```ts
    otherCharge: {
      nameThRequired: "กรุณากรอกชื่อรายการ (ไทย)",
      defaultAmountNegative: "จำนวนเงินเริ่มต้นต้องไม่ติดลบ",
    },
```

- [ ] **Step 4: Add `validateOtherCharge`**

Modify `src/lib/validation.ts` — add this function (anywhere after the imports, e.g. right after `validateTenant`):

```ts
export function validateOtherCharge(input: { nameTh?: string; defaultAmount?: number }): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.nameTh || input.nameTh.trim() === "") errors.nameTh = "validation.otherCharge.nameThRequired";
  if (input.defaultAmount !== undefined && input.defaultAmount < 0) errors.defaultAmount = "validation.otherCharge.defaultAmountNegative";
  return errors;
}
```

- [ ] **Step 5: Verify the build**

Run: `pnpm build`
Expected: no errors — `Translations` (interface) and both dictionaries (object literals typed against it) must match exactly, so a mismatch here would fail immediately with a clear TS2739/TS2353-style error naming the missing/excess key.

- [ ] **Step 6: Stage the change**

```bash
git add src/i18n/types.ts src/i18n/translations/en.ts src/i18n/translations/th.ts src/lib/validation.ts
```

Do not run `git commit`.

---

### Task 4: Legacy migration + master-data seeding

**Files:**
- Create: `src/data/migrations/legacyChargeMigration.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `otherChargeRepository` (Task 1), `STORAGE_KEYS`/`readRaw`/`writeValue`/`readCollection`/`writeCollection` (`src/data/storage/storage.ts`), `calculateBillingTotals` (Task 2's trimmed signature).
- Produces: `runLegacyChargeMigration(): void`, called once from `src/main.tsx`.

- [ ] **Step 1: Write the migration module**

`src/data/migrations/legacyChargeMigration.ts`:

```ts
import { readRaw, readCollection, writeCollection, writeValue, STORAGE_KEYS } from "@/data/storage/storage";
import { otherChargeRepository } from "@/data/repositories/otherChargeRepository";
import { calculateBillingTotals } from "@/lib/calculations";
import type { BillingRecord, BillingCharge } from "@/types/billing";
import type { PropertySettings } from "@/types/settings";

interface LegacySettingsFields {
  defaultGarbageFee?: number;
  defaultElectricityMeterMaintenanceFee?: number;
  defaultWaterMeterMaintenanceFee?: number;
}

interface LegacyBillingFields {
  garbageFee?: number;
  electricityMeterMaintenanceFee?: number;
  waterMeterMaintenanceFee?: number;
}

function readLegacySettings(): LegacySettingsFields {
  const raw = readRaw(STORAGE_KEYS.settings);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as LegacySettingsFields;
  } catch {
    return {};
  }
}

function seedOtherChargeMasters(): void {
  if (otherChargeRepository.getAll().length > 0) return;

  const legacy = readLegacySettings();
  const garbageFee = legacy.defaultGarbageFee ?? 50;
  const electricityMaintenanceFee = legacy.defaultElectricityMeterMaintenanceFee ?? 30;
  const waterMaintenanceFee = legacy.defaultWaterMeterMaintenanceFee ?? 30;

  otherChargeRepository.create({ nameTh: "ค่าขยะ", nameEn: "Garbage Fee", defaultAmount: garbageFee, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าบำรุงรักษามิเตอร์ไฟฟ้า", nameEn: "Electricity Meter Maintenance", defaultAmount: electricityMaintenanceFee, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าบำรุงรักษามิเตอร์น้ำ", nameEn: "Water Meter Maintenance", defaultAmount: waterMaintenanceFee, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าทำความสะอาด", nameEn: "Cleaning Fee", defaultAmount: 100, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าที่จอดรถ", nameEn: "Parking Fee", defaultAmount: 300, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าอินเทอร์เน็ต", nameEn: "Internet Fee", defaultAmount: 200, isActive: true });
  otherChargeRepository.create({ nameTh: "ค่าใช้จ่ายอื่น ๆ", nameEn: "Other Fee", defaultAmount: 0, isActive: true });
}

function migrateLegacyBillingRecords(): void {
  const masters = otherChargeRepository.getAll();
  const masterIdByNameTh = new Map(masters.map((m) => [m.nameTh, m.id] as const));
  const garbageMasterId = masterIdByNameTh.get("ค่าขยะ");
  const electricityMaintenanceMasterId = masterIdByNameTh.get("ค่าบำรุงรักษามิเตอร์ไฟฟ้า");
  const waterMaintenanceMasterId = masterIdByNameTh.get("ค่าบำรุงรักษามิเตอร์น้ำ");

  const rawRecords = readCollection<BillingRecord & LegacyBillingFields>(STORAGE_KEYS.billing);
  let changed = false;

  const migrated = rawRecords.map((record) => {
    const hasLegacyFields =
      record.garbageFee !== undefined ||
      record.electricityMeterMaintenanceFee !== undefined ||
      record.waterMeterMaintenanceFee !== undefined;
    if (!hasLegacyFields) return record;

    changed = true;
    const extraCharges: BillingCharge[] = [];
    if (record.garbageFee && record.garbageFee > 0) {
      extraCharges.push({ id: crypto.randomUUID(), masterId: garbageMasterId, name: "ค่าขยะ", amount: record.garbageFee });
    }
    if (record.electricityMeterMaintenanceFee && record.electricityMeterMaintenanceFee > 0) {
      extraCharges.push({
        id: crypto.randomUUID(),
        masterId: electricityMaintenanceMasterId,
        name: "ค่าบำรุงรักษามิเตอร์ไฟฟ้า",
        amount: record.electricityMeterMaintenanceFee,
      });
    }
    if (record.waterMeterMaintenanceFee && record.waterMeterMaintenanceFee > 0) {
      extraCharges.push({
        id: crypto.randomUUID(),
        masterId: waterMaintenanceMasterId,
        name: "ค่าบำรุงรักษามิเตอร์น้ำ",
        amount: record.waterMeterMaintenanceFee,
      });
    }

    const otherCharges = [...record.otherCharges, ...extraCharges];
    const totals = calculateBillingTotals({
      electricityAmount: record.electricity.amount,
      waterAmount: record.water.amount,
      rentAmount: record.rentAmount,
      otherCharges,
    });

    const { garbageFee, electricityMeterMaintenanceFee, waterMeterMaintenanceFee, ...rest } = record;
    return { ...rest, otherCharges, subtotal: totals.subtotal, total: totals.total };
  });

  if (changed) writeCollection(STORAGE_KEYS.billing, migrated);
}

function stripLegacySettingsFields(): void {
  const raw = readRaw(STORAGE_KEYS.settings);
  if (!raw) return;
  let parsed: (PropertySettings & LegacySettingsFields) | null = null;
  try {
    parsed = JSON.parse(raw) as PropertySettings & LegacySettingsFields;
  } catch {
    return;
  }
  const hasLegacyFields =
    parsed.defaultGarbageFee !== undefined ||
    parsed.defaultElectricityMeterMaintenanceFee !== undefined ||
    parsed.defaultWaterMeterMaintenanceFee !== undefined;
  if (!hasLegacyFields) return;

  const clean: PropertySettings = {
    propertyName: parsed.propertyName,
    propertyAddress: parsed.propertyAddress,
    phone: parsed.phone,
    defaultElectricityRate: parsed.defaultElectricityRate,
    defaultWaterRate: parsed.defaultWaterRate,
    defaultInvoiceNote: parsed.defaultInvoiceNote,
  };
  writeValue(STORAGE_KEYS.settings, clean);
}

export function runLegacyChargeMigration(): void {
  seedOtherChargeMasters();
  migrateLegacyBillingRecords();
  stripLegacySettingsFields();
}
```

- [ ] **Step 2: Wire it into `main.tsx`**

Replace the full contents of `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { seedIfEmpty } from "@/data/seed/seedData";
import { runLegacyChargeMigration } from "@/data/migrations/legacyChargeMigration";
import App from "@/app/App";
import "@/index.css";

seedIfEmpty();
runLegacyChargeMigration();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Note the order: `seedIfEmpty()` runs first (creates demo rooms/tenants/billing on a truly empty install), then `runLegacyChargeMigration()` runs unconditionally right after — so on a fresh install it seeds the 7 masters against the freshly-seeded demo billing records (which have no legacy fields, since Task 2 already removed them from `seedData.ts` — so `migrateLegacyBillingRecords` is a no-op there), and on an existing install with real legacy data it does the real migration.

- [ ] **Step 3: Verify the build**

Run: `pnpm build`
Expected: no errors.

- [ ] **Step 4: Manual verification — fresh install**

In a browser devtools console on the running app (`pnpm dev`), run `localStorage.clear()` and reload. Confirm: the app still seeds demo rooms/tenants/billing as before; `localStorage.getItem("rental.otherCharges")` now returns a JSON array of exactly 7 items (ค่าขยะ 50, ค่าบำรุงรักษามิเตอร์ไฟฟ้า 30, ค่าบำรุงรักษามิเตอร์น้ำ 30, ค่าทำความสะอาด 100, ค่าที่จอดรถ 300, ค่าอินเทอร์เน็ต 200, ค่าใช้จ่ายอื่น ๆ 0), all `isActive: true`. Reload the page again and confirm the array is still exactly 7 items (idempotency — no duplicates).

- [ ] **Step 5: Manual verification — simulated pre-existing install**

Still in devtools, run:

```js
localStorage.setItem("rental.settings", JSON.stringify({
  propertyName: "Test", propertyAddress: "", phone: "",
  defaultElectricityRate: 8, defaultWaterRate: 18,
  defaultGarbageFee: 55, defaultElectricityMeterMaintenanceFee: 35, defaultWaterMeterMaintenanceFee: 25,
  defaultInvoiceNote: "test note",
}));
localStorage.setItem("rental.billing", JSON.stringify([{
  id: "test-1", roomId: "room-1", billingMonth: "2026-01",
  electricity: { previousMeter: 0, currentMeter: 10, usage: 10, rate: 8, amount: 80 },
  water: { previousMeter: 0, currentMeter: 5, usage: 5, rate: 18, amount: 90 },
  rentAmount: 4500, garbageFee: 55, electricityMeterMaintenanceFee: 35, waterMeterMaintenanceFee: 0,
  otherCharges: [], subtotal: 4760, total: 4760, status: "draft",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
}]));
localStorage.removeItem("rental.otherCharges");
```

Reload the page. Confirm: `rental.otherCharges` now has 7 items, with the garbage/electricity-maintenance/water-maintenance amounts set to 55/35/30 (the water-maintenance one falls back to the default 30 since the simulated legacy record had it at 0 — wait, this fallback comes from the *settings* blob's `defaultWaterMeterMaintenanceFee: 25`, not the billing record — confirm it reads **25**, not 30). Confirm `rental.billing`'s one record now has `otherCharges` containing 2 entries (ค่าขยะ: 55, ค่าบำรุงรักษามิเตอร์ไฟฟ้า: 35 — **not** a water-maintenance entry, since that field was `0` in the simulated record and zero-value legacy fees are dropped per the approved design), `total` recomputed to `80 + 90 + 4500 + 55 + 35 = 4760`, and no `garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee` keys left on the object (`JSON.parse(localStorage.getItem("rental.billing"))[0].garbageFee === undefined`). Confirm `rental.settings` no longer has `defaultGarbageFee`/`defaultElectricityMeterMaintenanceFee`/`defaultWaterMeterMaintenanceFee` keys. Reload once more and confirm nothing changes further (idempotent).

Afterward, run `localStorage.clear()` and reload again to return to a clean seeded state before continuing.

- [ ] **Step 6: Stage the change**

```bash
git add src/data/migrations/legacyChargeMigration.ts src/main.tsx
```

Do not run `git commit`.

---

### Task 5: Settings page — Other Charge Master management UI

**Files:**
- Create: `src/features/settings/OtherChargeFormDialog.tsx`
- Create: `src/features/settings/OtherChargeTable.tsx`
- Create: `src/features/settings/OtherChargeSection.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

**Interfaces:**
- Consumes: `useOtherCharges()` (Task 1), `OtherChargeMaster`/`CreateOtherChargeInput`/`UpdateOtherChargeInput` (Task 1), `validateOtherCharge` (Task 3), the `settings.otherCharges*` i18n keys (Task 3), `ConfirmDialog` (`src/components/common/ConfirmDialog.tsx`), `StatusBadge` (`src/components/common/StatusBadge.tsx`), `EmptyState` (`src/components/common/EmptyState.tsx`).
- Produces: `<OtherChargeSection />` — a single self-contained component with no props, rendered inside `SettingsPage.tsx`.

**Design notes locked in from the spec:** enable/disable uses the existing `StatusBadge` (passing the literal `"active"`/`"inactive"`, which already type-checks against `TenantStatus`/`RoomStatus` and already has `status.active`/`status.inactive` translations — no new UI primitive, no new i18n key) plus a `Power` icon action button (matching the existing `Pencil`/`Trash2` icon-button convention from `RoomTable.tsx`), not a new Switch primitive. No search box and no separate mobile-card breakpoint for this table — it's a short master-data list (a handful of rows, 4 columns), unlike the wide multi-column Billing/Room tables that need it; a single `overflow-x-auto`-wrapped table is enough.

- [ ] **Step 1: Write the add/edit dialog**

`src/features/settings/OtherChargeFormDialog.tsx`:

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n";
import { validateOtherCharge, type ValidationErrors } from "@/lib/validation";
import type { OtherChargeMaster, CreateOtherChargeInput } from "@/types/otherCharge";

interface OtherChargeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge?: OtherChargeMaster;
  onSubmit: (input: CreateOtherChargeInput) => void;
}

interface FormState {
  nameTh: string;
  nameEn: string;
  defaultAmount: string;
}

function buildFormState(charge?: OtherChargeMaster): FormState {
  return {
    nameTh: charge?.nameTh ?? "",
    nameEn: charge?.nameEn ?? "",
    defaultAmount: charge ? String(charge.defaultAmount) : "0",
  };
}

export function OtherChargeFormDialog({ open, onOpenChange, charge, onSubmit }: OtherChargeFormDialogProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>(() => buildFormState(charge));
  const [errors, setErrors] = useState<ValidationErrors>({});

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(buildFormState(charge));
      setErrors({});
    }
    onOpenChange(next);
  }

  function handleSubmit() {
    const input: CreateOtherChargeInput = {
      nameTh: form.nameTh.trim(),
      nameEn: form.nameEn.trim() || undefined,
      defaultAmount: Number(form.defaultAmount) || 0,
      isActive: charge?.isActive ?? true,
    };
    const validationErrors = validateOtherCharge(input);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(input);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{charge ? t("settings.otherChargesEdit") : t("settings.otherChargesAdd")}</DialogTitle>
          <DialogDescription>{t("settings.otherChargesTitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="charge-name-th">{t("settings.otherChargesNameTh")}</Label>
            <Input
              id="charge-name-th"
              placeholder={t("settings.otherChargesNamePlaceholder")}
              value={form.nameTh}
              onChange={(e) => setForm({ ...form, nameTh: e.target.value })}
            />
            {errors.nameTh && <p className="text-xs text-destructive">{t(errors.nameTh)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="charge-name-en">{t("settings.otherChargesNameEn")}</Label>
            <Input
              id="charge-name-en"
              placeholder={t("settings.otherChargesNameEnPlaceholder")}
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="charge-amount">{t("settings.otherChargesDefaultAmount")}</Label>
            <Input
              id="charge-amount"
              type="number"
              min={0}
              placeholder={t("settings.otherChargesAmountPlaceholder")}
              value={form.defaultAmount}
              onChange={(e) => setForm({ ...form, defaultAmount: e.target.value })}
            />
            {errors.defaultAmount && <p className="text-xs text-destructive">{t(errors.defaultAmount)}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>{charge ? t("common.saveChanges") : t("settings.otherChargesAdd")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write the table**

`src/features/settings/OtherChargeTable.tsx`:

```tsx
import { Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import type { OtherChargeMaster } from "@/types/otherCharge";

interface OtherChargeTableProps {
  charges: OtherChargeMaster[];
  onEdit: (charge: OtherChargeMaster) => void;
  onDelete: (charge: OtherChargeMaster) => void;
  onToggleActive: (charge: OtherChargeMaster) => void;
}

export function OtherChargeTable({ charges, onEdit, onDelete, onToggleActive }: OtherChargeTableProps) {
  const { t, language } = useLanguage();
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.name")}</TableHead>
            <TableHead>{t("settings.otherChargesDefaultAmount")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges.map((charge) => (
            <TableRow key={charge.id}>
              <TableCell className="font-medium">
                {language === "en" && charge.nameEn ? charge.nameEn : charge.nameTh}
              </TableCell>
              <TableCell>{formatCurrency(charge.defaultAmount, language)}</TableCell>
              <TableCell>
                <StatusBadge status={charge.isActive ? "active" : "inactive"} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleActive(charge)}>
                        <Power className="h-4 w-4" />
                        <span className="sr-only">{t("common.status")}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{charge.isActive ? t("status.inactive") : t("status.active")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(charge)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">{t("common.edit")}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("common.edit")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(charge)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">{t("common.delete")}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("common.delete")}</TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Write the orchestrating section**

`src/features/settings/OtherChargeSection.tsx`:

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { OtherChargeTable } from "@/features/settings/OtherChargeTable";
import { OtherChargeFormDialog } from "@/features/settings/OtherChargeFormDialog";
import { useOtherCharges } from "@/hooks/useOtherCharges";
import { useLanguage } from "@/i18n";
import type { OtherChargeMaster } from "@/types/otherCharge";

export function OtherChargeSection() {
  const { t, language } = useLanguage();
  const { otherCharges, createOtherCharge, updateOtherCharge, deleteOtherCharge } = useOtherCharges();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<OtherChargeMaster | undefined>(undefined);
  const [deletingCharge, setDeletingCharge] = useState<OtherChargeMaster | undefined>(undefined);

  function displayName(charge: OtherChargeMaster): string {
    return language === "en" && charge.nameEn ? charge.nameEn : charge.nameTh;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t("settings.otherChargesTitle")}</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditingCharge(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t("settings.otherChargesAdd")}
        </Button>
      </CardHeader>
      <CardContent>
        {otherCharges.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={t("settings.otherChargesNoChargesTitle")}
            description={t("settings.otherChargesNoChargesDescription")}
            actionLabel={t("settings.otherChargesAdd")}
            onAction={() => {
              setEditingCharge(undefined);
              setFormOpen(true);
            }}
          />
        ) : (
          <OtherChargeTable
            charges={otherCharges}
            onEdit={(charge) => {
              setEditingCharge(charge);
              setFormOpen(true);
            }}
            onDelete={setDeletingCharge}
            onToggleActive={(charge) => {
              updateOtherCharge(charge.id, { isActive: !charge.isActive });
              toast.success(charge.isActive ? t("settings.otherChargesDeactivatedToast") : t("settings.otherChargesActivatedToast"));
            }}
          />
        )}
      </CardContent>

      <OtherChargeFormDialog
        key={editingCharge?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        charge={editingCharge}
        onSubmit={(input) => {
          if (editingCharge) {
            updateOtherCharge(editingCharge.id, input);
            toast.success(t("settings.otherChargesUpdatedToast"));
          } else {
            createOtherCharge(input);
            toast.success(t("settings.otherChargesSavedToast"));
          }
        }}
      />

      <ConfirmDialog
        open={deletingCharge !== undefined}
        onOpenChange={(open) => !open && setDeletingCharge(undefined)}
        title={t("settings.otherChargesDeleteConfirmTitle", { name: deletingCharge ? displayName(deletingCharge) : "" })}
        description={t("settings.otherChargesDeleteConfirmDescription")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => {
          if (!deletingCharge) return;
          deleteOtherCharge(deletingCharge.id);
          toast.success(t("settings.otherChargesDeletedToast"));
          setDeletingCharge(undefined);
        }}
      />
    </Card>
  );
}
```

- [ ] **Step 4: Render it in `SettingsPage.tsx`**

Modify `src/features/settings/SettingsPage.tsx` — add the import:

```ts
import { OtherChargeSection } from "@/features/settings/OtherChargeSection";
```

and render `<OtherChargeSection />` between the "Default Billing Rates" `Card` (closing `</Card>` from Task 2 Step 7) and the "Theme" `Card`:

```tsx
      </Card>

      <OtherChargeSection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.theme")}</CardTitle>
```

- [ ] **Step 5: Verify the build**

Run: `pnpm build`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run: `pnpm dev`, navigate to Settings. Confirm: the "Other Charge Master" card renders below "Default Billing Rates" showing the 7 seeded rows with correct names/amounts/Active badges. Click the Pencil icon on one row, change the amount, save — confirm the toast fires and the table updates. Click Power to deactivate one row — confirm its badge flips to Inactive and the toast fires. Click Trash2 on a different row — confirm the `ConfirmDialog` appears, confirm deletion removes it and fires the deleted toast. Click "Add Charge", fill in a name only (leave amount at 0), save — confirm it appears in the table. Try submitting the add dialog with an empty Thai name — confirm the validation error renders and the dialog does not close. Switch language to English via the header toggle and confirm all the new labels render in English (including the `nameEn` fallback display for rows that have one, and `nameTh` fallback for rows that don't).

- [ ] **Step 7: Stage the change**

```bash
git add src/features/settings/OtherChargeFormDialog.tsx src/features/settings/OtherChargeTable.tsx src/features/settings/OtherChargeSection.tsx src/features/settings/SettingsPage.tsx
```

Do not run `git commit`.

---

### Task 6: Billing form — Other Charge picker UI

**Files:**
- Modify: `src/features/billing/BillingPage.tsx`
- Modify: `src/features/billing/BillingFormDialog.tsx`

**Interfaces:**
- Consumes: `useOtherCharges()` (Task 1), `OtherChargeMaster` (Task 1), the `billing.otherCharges*` i18n keys (Task 3), `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` (already imported in `BillingFormDialog.tsx`).
- Produces: no new exports — this is the last functional piece; `BillingRecord.otherCharges` entries created here may now carry `masterId`.

- [ ] **Step 1: Wire the hook into `BillingPage.tsx`**

Modify `src/features/billing/BillingPage.tsx` — add the import and hook call:

```ts
import { useOtherCharges } from "@/hooks/useOtherCharges";
```

```ts
  const { otherCharges } = useOtherCharges();
```

(add this line right after the existing `const { settings } = useSettings();` line), and pass it down to the dialog:

```tsx
      <BillingFormDialog
        key={editingRecord?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        rooms={rooms}
        tenants={tenants}
        activeAssignments={activeAssignments}
        settings={settings}
        otherCharges={otherCharges}
        record={editingRecord}
        getLatestByRoomId={getLatestByRoomId}
        onSubmit={(input) => {
          if (editingRecord) {
            updateBilling(editingRecord.id, input);
          } else {
            createBilling(input);
          }
        }}
      />
```

- [ ] **Step 2: Extend `BillingFormDialog`'s props and `ChargeRow`**

Modify `src/features/billing/BillingFormDialog.tsx`. Add the import:

```ts
import type { OtherChargeMaster } from "@/types/otherCharge";
```

Add the new prop to `BillingFormDialogProps`:

```ts
interface BillingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  tenants: Tenant[];
  activeAssignments: RoomTenantAssignment[];
  settings: PropertySettings;
  otherCharges: OtherChargeMaster[];
  record?: BillingRecord;
  getLatestByRoomId: (roomId: string) => BillingRecord | undefined;
  onSubmit: (input: CreateBillingInput) => void;
}
```

Extend `ChargeRow` with `masterId`:

```ts
interface ChargeRow {
  key: string;
  masterId?: string;
  name: string;
  amount: string;
}
```

Update `chargesToRows` to carry `masterId` through when editing an existing record:

```ts
function chargesToRows(charges: BillingCharge[]): ChargeRow[] {
  return charges.map((c) => ({ key: c.id, masterId: c.masterId, name: c.name, amount: String(c.amount) }));
}
```

Add `otherCharges` to the destructured props in the component signature:

```tsx
export function BillingFormDialog({
  open,
  onOpenChange,
  rooms,
  tenants,
  activeAssignments,
  settings,
  otherCharges,
  record,
  getLatestByRoomId,
  onSubmit,
}: BillingFormDialogProps) {
```

- [ ] **Step 3: Add the master-charge picker state and handlers**

In the component body, right after the existing `const [errors, setErrors] = useState<ValidationErrors>({});` line, add:

```ts
  const [selectedMasterId, setSelectedMasterId] = useState("");

  const activeMasters = otherCharges.filter((c) => c.isActive);
  const availableMasters = activeMasters.filter(
    (m) => !form.otherCharges.some((c) => c.masterId === m.id)
  );

  function masterDisplayName(master: OtherChargeMaster): string {
    return language === "en" && master.nameEn ? master.nameEn : master.nameTh;
  }

  function addMasterCharge() {
    const master = activeMasters.find((m) => m.id === selectedMasterId);
    if (!master) return;
    setForm({
      ...form,
      otherCharges: [
        ...form.otherCharges,
        { key: crypto.randomUUID(), masterId: master.id, name: masterDisplayName(master), amount: String(master.defaultAmount) },
      ],
    });
    setSelectedMasterId("");
  }

  function addCustomCharge() {
    setForm({
      ...form,
      otherCharges: [...form.otherCharges, { key: crypto.randomUUID(), name: "", amount: "0" }],
    });
  }
```

Delete the now-superseded `addCharge` function (its body becomes `addCustomCharge` above) — `updateCharge` and `removeCharge` stay exactly as they are today; both already work generically on any `ChargeRow` regardless of whether it has a `masterId`.

- [ ] **Step 4: Replace the "otherCharges" section JSX**

Replace the whole block (currently the `<div className="space-y-2">` containing the `billing.otherCharges` heading through the closing `</div>` right before the totals-preview `<Separator />`):

```tsx
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{t("billing.otherCharges")}</h4>
            {availableMasters.length > 0 ? (
              <div className="flex items-center gap-2">
                <Select value={selectedMasterId} onValueChange={setSelectedMasterId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("billing.otherChargesSelectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMasters.map((master) => (
                      <SelectItem key={master.id} value={master.id}>
                        {masterDisplayName(master)} · {formatCurrency(master.defaultAmount, language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addMasterCharge} disabled={!selectedMasterId}>
                  <Plus className="h-4 w-4" /> {t("billing.otherChargesAdd")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("billing.otherChargesNoneAvailable")}</p>
            )}

            {form.otherCharges.map((charge) => (
              <div key={charge.key} className="flex items-center gap-2">
                {charge.masterId ? (
                  <p className="flex-1 text-sm">{charge.name}</p>
                ) : (
                  <Input
                    placeholder={t("billing.chargeNamePlaceholder")}
                    value={charge.name}
                    onChange={(e) => updateCharge(charge.key, "name", e.target.value)}
                  />
                )}
                <Input
                  type="number"
                  className="w-32"
                  placeholder={t("billing.chargeAmountPlaceholder")}
                  value={charge.amount}
                  onChange={(e) => updateCharge(charge.key, "amount", e.target.value)}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCharge(charge.key)}>
                  <X className="h-4 w-4" />
                  <span className="sr-only">{t("billing.otherChargesRemove")}</span>
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addCustomCharge}>
              <Plus className="h-4 w-4" /> {t("billing.addCharge")}
            </Button>
          </div>
```

- [ ] **Step 5: Fix `handleSubmit` to carry `masterId` through**

In `handleSubmit`, change the `otherCharges` mapping so `masterId` survives into the `CreateBillingInput` (custom rows still get filtered by empty name, exactly as before):

```ts
      otherCharges: form.otherCharges
        .filter((c) => c.name.trim() !== "")
        .map((c) => ({ masterId: c.masterId, name: c.name.trim(), amount: Number(c.amount) || 0 })),
```

- [ ] **Step 6: Verify the build**

Run: `pnpm build`
Expected: no errors.

- [ ] **Step 7: Manual verification**

Run: `pnpm dev`, go to Billing, click "Create Billing". Confirm: the "ค่าใช้จ่ายอื่น ๆ" section shows a dropdown of active masters (no rows pre-selected) plus a "+ เพิ่ม" button, and a "+ เพิ่มรายการเอง" button below. Select "ค่าขยะ" from the dropdown, click "+ เพิ่ม" — confirm it appears in the list with the master's default amount, editable, and the total updates. Confirm "ค่าขยะ" no longer appears in the dropdown (duplicate prevention). Edit the amount for that row — confirm the total live-updates and (after saving) confirm in Settings that the master's default amount for "ค่าขยะ" is unchanged. Click "+ เพิ่มรายการเอง", type a custom name/amount — confirm it's editable (both name and amount) and adds to the total. Remove a row — confirm the total recalculates and, if it was a master-derived row, it reappears in the dropdown. Save the bill, then open Invoices and preview it — confirm the invoice shows rent, electricity, water, then exactly the charges you added (no zero-amount rows for anything not selected), in that order. Edit an existing pre-migration seed billing record (one that has `otherCharges: []` today) and confirm it still opens and saves correctly.

- [ ] **Step 8: Stage the change**

```bash
git add src/features/billing/BillingPage.tsx src/features/billing/BillingFormDialog.tsx
```

Do not run `git commit`.

---

### Task 7: Final verification pass and `context.md` update

**Files:**
- Modify: `context.md`

**Interfaces:** none — this task only verifies and documents what Tasks 1-6 already built.

- [ ] **Step 1: Full build and lint**

Run: `pnpm build`
Expected: no errors.

Run: `pnpm lint`
Expected: no errors (fix any `oxlint` findings before proceeding).

- [ ] **Step 2: Walk the design doc's Verification Plan**

Open `docs/superpowers/specs/2026-08-10-billing-other-charges-design.md`'s "Verification Plan" section and manually re-check every line against the running app (`pnpm dev`) in both Thai and English (use the header language toggle): Settings shows only the 3 true defaults; Other Charge Master add/edit/delete/enable-disable all work; a new billing record starts with zero other charges; the dropdown pre-fills the master default and is independently editable per bill without mutating the master; the same master cannot be added twice; a custom one-time charge works; removing a charge recalculates the total; the invoice shows only charges actually present; pre-existing billing records still load; both languages render correctly everywhere touched by this change.

- [ ] **Step 3: Update `context.md`**

Modify `context.md`:

In the **Domain Model** section, update the `PropertySettings` bullet:

```
- **PropertySettings** (`src/types/settings.ts`) — single record: property name/address/phone plus the three true monthly defaults (`defaultElectricityRate`, `defaultWaterRate`, `defaultInvoiceNote`), used to prefill new rooms and billing records. Fixed/optional fee amounts (garbage, meter maintenance, etc.) are **not** stored here — see `OtherChargeMaster` below.
```

Update the `BillingRecord` bullet:

```
- **BillingRecord** (`src/types/billing.ts`) — `id, roomId, tenantId?, invoiceNumber?, billingMonth ("YYYY-MM"), electricity: MeterReading, water: MeterReading, rentAmount, otherCharges: BillingCharge[], subtotal, total, status, issuedAt?, dueDate?, paidAt?, createdAt, updatedAt`. `status: "draft" | "issued" | "paid" | "overdue"`. `invoiceNumber` is only set once the record is issued. There is no dedicated garbage-fee/meter-maintenance-fee field — every optional charge, fixed or one-off, lives in `otherCharges`.
```

Update the `BillingCharge` bullet:

```
- **BillingCharge** — `id, masterId?, name, amount`. `masterId` links back to an `OtherChargeMaster` row when the charge was added from the master list; it's absent for a one-time custom charge typed directly on a bill. `name`/`amount` are a snapshot at the time the charge was added to this specific bill — editing them here never changes the master record, and vice versa.
```

Add a new bullet after `BillingCharge`:

```
- **OtherChargeMaster** (`src/types/otherCharge.ts`) — `id, nameTh, nameEn?, defaultAmount, isActive, createdAt, updatedAt`. Reusable master data for *optional* per-bill charges (garbage, meter maintenance, parking, internet, cleaning, etc.). Master rows are never automatically added to a bill — a user explicitly picks one from the Settings-managed list when creating/editing a `BillingRecord`, at which point its `defaultAmount` is copied into a new `BillingCharge` that can then be edited per bill without touching the master.
```

In the **Business Rules** section, update the billing-totals bullet:

```
- **Billing totals:** `subtotal = electricity.amount + water.amount + rentAmount`; `total = subtotal + sum(otherCharges.amount)` (`calculateBillingTotals` in `src/lib/calculations.ts`). There are no separate fixed-fee fields in the total — every optional charge, whether master-derived or custom, is just an `otherCharges` entry.
```

In the **Storage Keys** section, add one line:

```
- `rental.otherCharges`
```

Add a new subsection right after **Storage Keys**, before **Important Files**:

```
# Data Migration History

**2026-08-10 — Fixed-fee-to-master-data migration.** `PropertySettings` used to carry `defaultGarbageFee`/`defaultElectricityMeterMaintenanceFee`/`defaultWaterMeterMaintenanceFee`, and `BillingRecord` mirrored them as dedicated scalar fields (`garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee`), auto-applied to every new bill. These were replaced by `OtherChargeMaster` (optional, explicitly attached per bill) and folded into `BillingRecord.otherCharges`. `src/data/migrations/legacyChargeMigration.ts`, called unconditionally from `main.tsx` (not nested inside `seedIfEmpty()`, since that only runs on a truly empty install), performs a one-time idempotent migration: seeds 7 example `OtherChargeMaster` rows (using any pre-existing legacy settings values where present), converts any pre-existing `BillingRecord`'s nonzero legacy fee fields into `otherCharges` entries linked back to the matching seeded master by name, and strips the legacy fields from both collections. Safe to re-run — once the legacy fields are gone from a record, there's nothing left to migrate.
```

In **Important Files**, add rows for the new files:

```
| `src/types/otherCharge.ts` | `OtherChargeMaster` type + create/update input types |
| `src/data/repositories/otherChargeRepository.ts` | CRUD for the Other Charge Master list |
| `src/hooks/useOtherCharges.ts` | Reactive wrapper around `otherChargeRepository` |
| `src/data/migrations/legacyChargeMigration.ts` | One-time idempotent legacy-fee-to-master-data migration, run from `main.tsx` |
| `src/features/settings/OtherChargeSection.tsx`, `OtherChargeTable.tsx`, `OtherChargeFormDialog.tsx` | Other Charge Master management UI on the Settings page |
```

In the **Feature Status** table, update the Settings row's Notes column:

```
| Settings | Done | Property info + the 3 true billing defaults (electricity rate, water rate, invoice note), plus a separate Other Charge Master (optional per-bill charges); used by new rooms and billing — see Data Migration History |
```

- [ ] **Step 4: Stage the change**

```bash
git add context.md
```

Do not run `git commit`.

---

## Self-Review Notes (from authoring this plan)

- **Spec coverage:** every requirement in the design doc maps to a task above — data model split (Tasks 1-2), master CRUD UI with the exact spec'd column set and Pencil/Trash2/status-toggle actions (Task 5), non-auto-populated billing picker with duplicate prevention, per-bill amount override, and custom one-time charges (Task 6), invoice item order and no-zero-rows behavior (Task 2 Step 10), migration idempotency and ordering relative to `seedIfEmpty` (Task 4), localization for every new string (Task 3), and the `context.md` update (Task 7).
- **Type consistency check performed:** `calculateBillingTotals`'s new signature (Task 2 Step 3) is used identically in `billingRepository.ts` (Task 2 Step 5), `BillingFormDialog.tsx` (Task 2 Step 8), and `legacyChargeMigration.ts` (Task 4 Step 1) — all three pass `{ electricityAmount, waterAmount, rentAmount, otherCharges }`, no stray `garbageFee`-style param anywhere. `ChargeRow`'s `masterId?: string` (Task 6 Step 2) matches `BillingCharge.masterId?: string` (Task 2 Step 2). `OtherChargeMaster`/`CreateOtherChargeInput` (Task 1) are used with identical field names in the repository (Task 1), the hook (Task 1), the Settings dialog (Task 5), and the migration's `otherChargeRepository.create(...)` calls (Task 4) — `nameTh`/`nameEn`/`defaultAmount`/`isActive` throughout, no drift.
- **Known scope trade-off carried over from the design doc:** `BillingCharge.name` is a single string snapshotted at add-time in whichever UI language was active, not a `nameTh`/`nameEn` pair — already flagged to the user and approved before planning began.
