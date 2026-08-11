# Design: Separate Default Billing Settings from an Other Charge Master

Date: 2026-08-10
Status: Approved by user, ready for implementation planning

## Problem

`PropertySettings` currently bundles two conceptually different things under "Default Billing Rates": true per-month defaults (electricity rate, water rate, invoice note) and three fixed fee amounts (garbage fee, electricity meter maintenance fee, water meter maintenance fee) that are auto-applied to every new billing record. `BillingRecord` mirrors this by carrying those three fees as dedicated scalar fields, separate from the free-form `otherCharges: BillingCharge[]` array that already exists for ad hoc one-off charges.

This conflates "always applies" defaults with "sometimes applies" charges, and makes it impossible to add a new optional charge type (e.g. parking, internet, cleaning) without a code change. The business goal is: only electricity rate, water rate, and invoice note should be true defaults. Every other charge — garbage, meter maintenance, parking, internet, cleaning, anything else — should be optional, reusable master data that a user explicitly attaches to a specific bill, with the amount editable per bill without mutating the master record.

## Current State (verified against the code, 2026-08-10)

- `src/types/settings.ts` — `PropertySettings` already has `defaultElectricityRate`, `defaultWaterRate`, `defaultGarbageFee`, `defaultElectricityMeterMaintenanceFee`, `defaultWaterMeterMaintenanceFee`, `defaultInvoiceNote`, plus property info fields.
- `src/types/billing.ts` — `BillingRecord`/`CreateBillingInput`/`UpdateBillingInput` carry `garbageFee`, `electricityMeterMaintenanceFee`, `waterMeterMaintenanceFee` as dedicated scalar fields, entirely separate from `otherCharges: BillingCharge[]` (today just `{id, name, amount}`, free-text, always starts empty on a new record).
- `src/lib/calculations.ts` — `calculateBillingTotals` sums the three fixed fees directly into `subtotal`, then adds `otherCharges` on top to get `total`.
- `src/features/billing/BillingFormDialog.tsx` — the three fixed fees render as three dedicated `<Input type="number">` fields, pre-filled from `PropertySettings` defaults on new records. `otherCharges` renders as a manual add/remove list, always starting empty.
- `src/features/invoices/InvoicePrintView.tsx` — renders 4 hardcoded line items (rent, electricity, water, garbage, elec-maintenance, water-maintenance — 6 rows including meters) plus a `.map()` over `otherCharges` for dynamic rows.
- `src/data/seed/seedData.ts` — seeds 4 demo `BillingRecord`s, all with `garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30`; one has an extra ad hoc `otherCharges: [{name: "Parking", amount: 300}]`. `seedIfEmpty()` short-circuits entirely (`if (roomRepository.getAll().length > 0) return`) if any room already exists.
- There is no `OtherChargeMaster` concept, no Switch UI primitive, and no `otherCharges` storage key today.

## Target Data Model

**`src/types/settings.ts`** — trim to true defaults only:

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

**`src/types/otherCharge.ts`** (new file):

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
```

**`src/types/billing.ts`**:

```ts
export interface BillingCharge {
  id: string;
  masterId?: string;   // present when derived from OtherChargeMaster, absent for a one-time custom charge
  name: string;
  amount: number;
}

export interface BillingRecord {
  id: string;
  roomId: string;
  tenantId?: string;
  invoiceNumber?: string;
  billingMonth: string;
  electricity: MeterReading;
  water: MeterReading;
  rentAmount: number;
  otherCharges: BillingCharge[];   // garbageFee/electricityMeterMaintenanceFee/waterMeterMaintenanceFee removed — now just entries here
  subtotal: number;   // electricity + water + rent only
  total: number;       // subtotal + sum(otherCharges.amount)
  status: BillingStatus;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

`CreateBillingInput`/`UpdateBillingInput` drop `garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee` to match.

**Deliberate scope decision:** `BillingCharge.name` stays a single string (not a `nameTh`/`nameEn` pair), matching the shape the user's spec gave and matching how ad hoc charges already behave today (no i18n at all). A master-derived charge snapshots whichever UI language was active at the moment it was added to the bill. Switching the app language afterward does not retranslate historical bill line items. This is an accepted trade-off, not an oversight.

## Storage

`src/data/storage/storage.ts` — add one key:

```ts
export const STORAGE_KEYS = {
  rooms: "rooms",
  tenants: "tenants",
  assignments: "assignments",
  billing: "billing",
  settings: "settings",
  otherCharges: "otherCharges",   // new — rental.otherCharges
} as const;
```

`src/data/repositories/otherChargeRepository.ts` (new), same shape as every other repository:

```ts
export const otherChargeRepository = {
  getAll(): OtherChargeMaster[]
  getActive(): OtherChargeMaster[]   // isActive === true, for the billing-form dropdown
  getById(id: string): OtherChargeMaster | undefined
  create(input: Omit<OtherChargeMaster, "id" | "createdAt" | "updatedAt">): OtherChargeMaster
  update(id: string, input: Partial<Omit<OtherChargeMaster, "id" | "createdAt" | "updatedAt">>): OtherChargeMaster
  delete(id: string): void
}
```

`src/hooks/useOtherCharges.ts` (new) — thin state wrapper identical in shape to `useRooms`/`useTenants`: holds the collection in `useState`, seeded from `otherChargeRepository.getAll()`, exposes `createCharge`/`updateCharge`/`deleteCharge`, each calling the repository then `refresh()`.

## Migration (idempotent, runs on every boot)

**Critical constraint:** `seedIfEmpty()` returns immediately if `roomRepository.getAll().length > 0` — i.e. it never runs at all for any installation that already has data. Since migration must run precisely for installations with existing data, migration logic cannot live inside `seedIfEmpty()`. It needs its own unconditional, idempotent entry point.

New `src/data/migrations/legacyChargeMigration.ts`, exporting `runLegacyChargeMigration(): void`, called once from `src/main.tsx` (alongside, not inside, `seedIfEmpty()`):

1. **Seed the Other Charge Master table**, guarded by `otherChargeRepository.getAll().length === 0` (so this step runs exactly once, on whichever boot is first — fresh install or existing install alike):
   - Read the raw stored settings blob (bypassing the trimmed `PropertySettings` type) to recover any legacy `defaultGarbageFee`/`defaultElectricityMeterMaintenanceFee`/`defaultWaterMeterMaintenanceFee` values if present; otherwise fall back to 50/30/30.
   - Create all 7 example master rows: ค่าขยะ, ค่าบำรุงรักษามิเตอร์ไฟฟ้า, ค่าบำรุงรักษามิเตอร์น้ำ (amounts from the step above), ค่าทำความสะอาด, ค่าที่จอดรถ (300), ค่าอินเทอร์เน็ต, ค่าใช้จ่ายอื่น ๆ (remaining four at spec-example defaults), all `isActive: true`.
2. **Migrate existing `BillingRecord`s.** Read the raw billing collection (as loosely-typed objects, since legacy records carry fields the new `BillingRecord` type no longer declares). For every record that still has any of `garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee`:
   - For each of the three fields whose value is `> 0`, append a `BillingCharge` to `otherCharges` (`masterId` set to the matching seeded master's id, matched by name; `name` set to that master's `nameTh`; `amount` = the legacy field's value). A value of exactly `0` is dropped, not migrated (per the "invoice must not show unselected items" rule).
   - Delete the three legacy keys from the record.
   - Recompute `subtotal`/`total` via the new `calculateBillingTotals` signature.
   - Write the whole collection back once.
   - This step is naturally idempotent: once the legacy keys are deleted from a record, a second run finds nothing left to migrate on that record.
3. **Strip the three legacy default-fee keys from the stored settings blob** (cosmetic cleanup — construct a clean object containing only the fields in the trimmed `PropertySettings` type and write it back), guarded on the raw blob actually containing any of those keys.

## Calculations

`src/lib/calculations.ts`:

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

`billingRepository.computeRecord` updates to match the trimmed `CreateBillingInput` (no more `garbageFee`/`electricityMeterMaintenanceFee`/`waterMeterMaintenanceFee` params).

## Settings Page

`src/features/settings/SettingsPage.tsx` — "อัตราค่าบริการเริ่มต้น" (`settings.defaultBillingRates`) card trims to `defaultElectricityRate` / `defaultWaterRate` / `defaultInvoiceNote` only, reusing the existing i18n keys as-is (no rename — see i18n section).

New "ค่าใช้จ่ายอื่น ๆ" (Other Charge Master) section, new files under `src/features/settings/`:

- `OtherChargeSection.tsx` — orchestrates the hook, table, form dialog, delete confirm, same pattern as `RoomsPage`/`TenantsPage` compose their table + dialogs.
- `OtherChargeTable.tsx` — columns: charge name (shows `nameTh`, with `nameEn` as secondary text if present), default amount (via `formatCurrency`), status (a `StatusBadge`-style Active/Inactive badge), actions (Pencil → edit dialog, Trash2 → `ConfirmDialog` then delete, a third icon — `Power` from lucide-react — to toggle `isActive` inline).
- `OtherChargeFormDialog.tsx` — add/edit form: `nameTh` (required), `nameEn` (optional), `defaultAmount` (number ≥ 0), `isActive` (defaults true on create). Sonner toast on save/update/delete/toggle, same convention as every other CRUD flow in the app.

## Billing Form

`src/features/billing/BillingFormDialog.tsx`:

- Remove the three fixed-fee `<Input>` fields and their `FormState` entries entirely.
- New "ค่าใช้จ่ายอื่น ๆ" section:
  - A shadcn `Select` listing `otherChargeRepository.getActive()` entries whose `id` is not already present as a `masterId` in the current selection (prevents duplicates by hiding already-added items from the list, per the approved design), showing name + `defaultAmount`.
  - A "+ เพิ่ม" button appends the selected master item to local state as `{key, masterId, name, amount: defaultAmount}` — `amount` is a normal editable number input from that point on; editing it never touches the master record.
  - A "+ เพิ่มรายการเอง" button appends a blank custom row (`masterId` undefined, empty `name`, `0` amount) for one-time charges. Rows with an empty name are dropped on submit, same as today's existing filter behavior.
  - Every row has a remove `[X]` button.
- Live totals preview recalculated using the new `calculateBillingTotals` signature (no more fixed-fee params).

## Invoice

`src/features/invoices/InvoicePrintView.tsx` — row order becomes: ค่าเช่ารายเดือน (rent) → ค่าไฟฟ้า (electricity) → ค่าน้ำประปา (water) → `otherCharges` (looped, existing `invoice.otherChargeItem` key per entry). The three hardcoded fee rows (garbage, electricity-maintenance, water-maintenance) are removed — those charges now only appear if present in `otherCharges`, so a bill without them shows no rows for them at all (no more zero-amount rows for unselected items).

## i18n

Removed (dead once the fixed-fee fields are gone): `settings.defaultGarbageFee`, `settings.electricityMaintenanceFee`, `settings.waterMaintenanceFee`, `billing.garbageFee`, `billing.electricityMaintenanceFee`, `billing.waterMaintenanceFee`, `invoice.garbageItem`, `invoice.electricityMaintenanceItem`, `invoice.waterMaintenanceItem`. These must be deleted from `Translations` (`src/i18n/types.ts`) and both dictionaries — TypeScript strict mode means an orphaned key left in only one dictionary would already be a compile error, and an unused-but-present key in all three is dead weight the repo convention doesn't otherwise carry.

Kept as-is (no rename): `settings.defaultBillingRates`, `settings.defaultElectricityRate`, `settings.defaultWaterRate`, `settings.defaultInvoiceNote`. The user's spec illustratively suggested a `settings.defaultBilling.*` nested namespace for these — kept flat instead since they already exist under the current flat names and a rename here is pure churn with no behavior change.

**Naming convention note (fixed during self-review):** neither `settings.*` nor `billing.*` uses nested sub-objects anywhere today (both are flat key lists on the `Translations` interface; the only nested domain in the app is `validation.<entity>.<field>`, which doesn't apply here). So new keys below are flat, matching the existing convention, not the dotted `settings.otherCharges.title`-style namespacing the user's message used illustratively.

Added to `settings.*` (flat): `otherChargesTitle`, `otherChargesAdd`, `otherChargesEdit`, `otherChargesNameTh`, `otherChargesNameEn`, `otherChargesDefaultAmount`, `otherChargesStatus`, `otherChargesActive`, `otherChargesInactive`, `otherChargesNamePlaceholder`, `otherChargesNameEnPlaceholder`, `otherChargesAmountPlaceholder`, `otherChargesNoChargesTitle`, `otherChargesNoChargesDescription`, `otherChargesSavedToast`, `otherChargesUpdatedToast`, `otherChargesDeletedToast`, `otherChargesActivatedToast`, `otherChargesDeactivatedToast`, `otherChargesDeleteConfirmTitle`, `otherChargesDeleteConfirmDescription`.

Added to `billing.*` (flat) — note `billing.otherCharges` already exists today as the section-title string and is kept unchanged for that purpose: `otherChargesSelectPlaceholder` ("เลือกค่าใช้จ่าย"), `otherChargesAdd` ("+ เพิ่ม", confirms the dropdown selection), `otherChargesNoneAvailable` (shown when every active master is already on the bill), `otherChargesRemove`. The existing `billing.addCharge` label is repurposed as the "+ เพิ่มรายการเอง" custom-row button (conceptually the same action — adding a manual row — that the old always-empty flow used); the existing `billing.chargeNamePlaceholder`/`billing.chargeAmountPlaceholder` are kept unchanged for that custom row's inputs.

## Verification Plan

- Settings page shows only electricity rate, water rate, invoice note as defaults.
- Other Charge Master supports add / edit / delete / enable-disable.
- Creating a new billing record does not auto-add any other charges.
- User can select an active master charge from the dropdown; it appears with the master's `defaultAmount` pre-filled and editable; editing it does not change the master.
- The same master charge cannot be added twice to one bill.
- A custom one-time charge can be added without existing in Master.
- Removing a charge recalculates the total live.
- Invoice preview/print shows only the charges actually present on that record — no zero rows for unselected fees.
- Existing (pre-migration) billing records still load and display correctly after migration runs.
- Thai and English both render correctly for every new/changed string.
- `pnpm build` and `pnpm lint` are clean.

## Self-Review Addendum (found while drafting the implementation plan)

`src/features/billing/BillingTable.tsx` also reads `record.garbageFee` directly — a dedicated desktop-table column (`billing.garbageFee` header) and a dedicated mobile-card detail line (`billing.garbageDetailLine`). This wasn't caught during the initial design pass. Fix: remove both (the column and the detail line) rather than replacing them with anything — `record.total` already reflects every charge including `otherCharges`, so no replacement column is needed. This is a mechanical consequence of removing the scalar fee fields, not a new design decision.

## Follow-up

After implementation, `context.md` needs updates to: the `BillingRecord`/`PropertySettings`/`OtherChargeMaster` shapes in Domain Model, the new `rental.otherCharges` storage key, the billing-totals formula in Business Rules, and a short note documenting the one-time legacy migration.
