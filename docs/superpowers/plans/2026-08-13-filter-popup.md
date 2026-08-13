# Filter Button + Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline `Select` filter dropdown(s) on Rooms, Tenants, Billing, and Invoices with one shared `FilterButton` component — a button that opens a popup listing that page's filter fields, applied only on confirm.

**Architecture:** One new self-contained component (`src/components/common/FilterButton.tsx`) wraps the existing `Dialog` primitives in the standard uncontrolled-open pattern, taking a `fields` config array + the page's currently-applied `values` + an `onApply` callback. Each page keeps its existing `useState` filter variables and `useMemo` filtering logic untouched — only the toolbar JSX changes.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS v4, shadcn/ui (`Dialog`, `Select`, `Badge`, `Label`, `Button`), existing lightweight i18n (`t()`).

## Global Constraints

- No new filter field types — every field is a single-select dropdown (spec decision).
- Search input stays inline, unchanged, applies live (not part of the popup).
- Popup fields are staged (`draft` state) — only `onApply(draft)` on "ยืนยัน" (Confirm) touches the page's real filter state. "ล้างค่า" (Clear) resets the popup's own draft to `"all"` for every field and does NOT close the popup or call `onApply`.
- No changes to any page's filtering `useMemo` logic, repository, or hook — only toolbar JSX.
- Three new i18n keys only: `common.filter`, `common.clearFilters`, `common.year` (both `en.ts` and `th.ts`). `common.year` is needed because Billing's and Invoices' popups now show an explicit label above the year `Select` — the old inline `Select` never had one (its `SelectValue` was self-explanatory in a labeled toolbar position; a field inside a config-driven popup needs an explicit label). Reuse the existing `common.confirm` for the Confirm button. No other new keys.
- This repo has no automated test suite. Verification per task is `npx tsc -b --noEmit` (must stay clean) plus reading the diff for correctness — no browser screenshot pipeline for this plan (the user will do a manual pass themselves).
- Applies at every breakpoint — the inline `Select`(s) are removed entirely from all four toolbars, not just hidden below some width.

---

## Task 1: Add i18n keys

**Files:**
- Modify: `src/i18n/translations/en.ts`
- Modify: `src/i18n/translations/th.ts`

**Interfaces:**
- Produces: `t("common.filter")`, `t("common.clearFilters")`, `t("common.year")` — consumed by Task 2's `FilterButton` and Tasks 5-6's field configs.

- [ ] **Step 1: Add the three keys to the `common` block in `en.ts`**

Find this block (currently ends with `nextPage: "Next page",`):
```ts
  common: {
    ...
    previousPage: "Previous page",
    nextPage: "Next page",
  },
```
Change to:
```ts
  common: {
    ...
    previousPage: "Previous page",
    nextPage: "Next page",
    filter: "Filter",
    clearFilters: "Clear",
    year: "Year",
  },
```

- [ ] **Step 2: Add the matching keys to the `common` block in `th.ts`**

Find this block (currently ends with `nextPage: "หน้าถัดไป",`):
```ts
  common: {
    ...
    previousPage: "หน้าก่อนหน้า",
    nextPage: "หน้าถัดไป",
  },
```
Change to:
```ts
  common: {
    ...
    previousPage: "หน้าก่อนหน้า",
    nextPage: "หน้าถัดไป",
    filter: "ตัวกรอง",
    clearFilters: "ล้างค่า",
    year: "ปี",
  },
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors (adding object properties to an existing typed literal is safe; `src/i18n/types.ts` derives its `Translations` type from `en.ts`'s shape, so both files must have the exact same keys or this step will fail — if it fails, confirm both files got the same three new keys with the same names).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/translations/en.ts src/i18n/translations/th.ts
git commit -m "feat: add filter/clearFilters/year i18n keys"
```

---

## Task 2: Create the `FilterButton` component

**Files:**
- Create: `src/components/common/FilterButton.tsx`

**Interfaces:**
- Consumes: `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` (`@/components/ui/dialog`), `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` (`@/components/ui/select`), `Button` (`@/components/ui/button`), `Badge` (`@/components/ui/badge`), `Label` (`@/components/ui/label`), `useLanguage` (`@/i18n`), `Filter` icon (`lucide-react`).
- Produces (consumed by Tasks 3-6):
  ```ts
  export interface FilterFieldOption { value: string; label: string }
  export interface FilterField { key: string; label: string; options: FilterFieldOption[] }
  export function FilterButton(props: {
    fields: FilterField[];
    values: Record<string, string>;
    onApply: (values: Record<string, string>) => void;
  }): JSX.Element
  ```

- [ ] **Step 1: Write the component**

```tsx
import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/i18n";

export interface FilterFieldOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  options: FilterFieldOption[];
}

interface FilterButtonProps {
  fields: FilterField[];
  values: Record<string, string>;
  onApply: (values: Record<string, string>) => void;
}

export function FilterButton({ fields, values, onApply }: FilterButtonProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(values);

  const activeCount = fields.filter((field) => values[field.key] && values[field.key] !== "all").length;

  function handleOpenChange(next: boolean) {
    if (next) setDraft(values);
    setOpen(next);
  }

  function handleClear() {
    const cleared: Record<string, string> = {};
    fields.forEach((field) => {
      cleared[field.key] = "all";
    });
    setDraft(cleared);
  }

  function handleConfirm() {
    onApply(draft);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative w-full shrink-0 sm:w-auto">
          <Filter />
          {t("common.filter")}
          {activeCount > 0 && (
            <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full px-1">
              {activeCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("common.filter")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label>{field.label}</Label>
              <Select
                value={draft[field.key] ?? "all"}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClear}>
            {t("common.clearFilters")}
          </Button>
          <Button onClick={handleConfirm}>{t("common.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors. (This file isn't imported anywhere yet, so a clean type-check here only confirms the file itself is well-typed in isolation — Tasks 3-6 are what actually exercise it.)

- [ ] **Step 3: Commit**

```bash
git add src/components/common/FilterButton.tsx
git commit -m "feat: add shared FilterButton component"
```

---

## Task 3: Wire `FilterButton` into Rooms

**Files:**
- Modify: `src/features/rooms/RoomsPage.tsx`

**Interfaces:**
- Consumes: `FilterButton`, `FilterField` from `@/components/common/FilterButton` (Task 2). `ROOM_STATUSES` (already defined at the top of this file), `statusFilter`/`setStatusFilter` (already defined), `t` (already destructured from `useLanguage()`).

- [ ] **Step 1: Add the import**

Add near the other `@/components/common/*` imports:
```tsx
import { FilterButton } from "@/components/common/FilterButton";
```

- [ ] **Step 2: Replace the inline `Select` with `FilterButton`**

Find (lines 141-159):
```tsx
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as RoomStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
                {ROOM_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
```

Replace with:
```tsx
            <FilterButton
              fields={[
                {
                  key: "status",
                  label: t("common.status"),
                  options: [
                    { value: "all", label: t("common.allStatuses") },
                    ...ROOM_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
                  ],
                },
              ]}
              values={{ status: statusFilter }}
              onApply={(values) => {
                setStatusFilter((values.status as RoomStatus | "all") ?? "all");
                setPage(1);
              }}
            />
```

- [ ] **Step 3: Remove now-unused `Select` imports if nothing else on the page uses them**

Check whether `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` (imported at the top from `@/components/ui/select`) are still used anywhere else in this file after Step 2. If not, remove that whole import line. (In this file they are not used elsewhere — remove the import.)

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors. (This will catch an unused-import or a leftover reference to the removed `Select` if Step 3 was done incorrectly — this repo's `tsconfig` has strict mode on, and `oxlint` would also flag an unused import if `tsc` doesn't.)

- [ ] **Step 5: Commit**

```bash
git add src/features/rooms/RoomsPage.tsx
git commit -m "feat: replace Rooms status filter with FilterButton popup"
```

---

## Task 4: Wire `FilterButton` into Tenants

**Files:**
- Modify: `src/features/tenants/TenantsPage.tsx`

**Interfaces:**
- Consumes: `FilterButton` (Task 2). `TENANT_STATUSES`, `statusFilter`/`setStatusFilter`, `t` (all already defined in this file).

- [ ] **Step 1: Add the import**

```tsx
import { FilterButton } from "@/components/common/FilterButton";
```

- [ ] **Step 2: Replace the inline `Select` with `FilterButton`**

Find (lines 126-144):
```tsx
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as TenantStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
                {TENANT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
```

Replace with:
```tsx
            <FilterButton
              fields={[
                {
                  key: "status",
                  label: t("common.status"),
                  options: [
                    { value: "all", label: t("common.allStatuses") },
                    ...TENANT_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
                  ],
                },
              ]}
              values={{ status: statusFilter }}
              onApply={(values) => {
                setStatusFilter((values.status as TenantStatus | "all") ?? "all");
                setPage(1);
              }}
            />
```

- [ ] **Step 3: Remove now-unused `Select` imports if nothing else on the page uses them**

Same check as Task 3 Step 3 — in this file, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` are not used elsewhere either; remove that import line.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/tenants/TenantsPage.tsx
git commit -m "feat: replace Tenants status filter with FilterButton popup"
```

---

## Task 5: Wire `FilterButton` into Billing

**Files:**
- Modify: `src/features/billing/BillingPage.tsx`

**Interfaces:**
- Consumes: `FilterButton` (Task 2). `BILLING_STATUSES`, `MONTHS`, `availableYears`, `statusFilter`/`setStatusFilter`, `monthFilter`/`setMonthFilter`, `yearFilter`/`setYearFilter`, `t`, `language`, `monthName`, `yearLabel` (all already defined/imported in this file). `t("common.year")` (added by Task 1) is used as the year field's label.

- [ ] **Step 1: Add the import**

```tsx
import { FilterButton } from "@/components/common/FilterButton";
```

- [ ] **Step 2: Replace the three inline `Select`s with one `FilterButton`**

Find (lines 219-275, the three `<Select>...</Select>` blocks for status, month, year):
```tsx
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as BillingStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
                {BILLING_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={monthFilter}
              onValueChange={(value) => {
                setMonthFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allMonths")}</SelectItem>
                {MONTHS.map((month) => (
                  <SelectItem key={month} value={month}>
                    {monthName(Number(month), language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={yearFilter}
              onValueChange={(value) => {
                setYearFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allYears")}</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {yearLabel(Number(year), language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
```

Replace with:
```tsx
            <FilterButton
              fields={[
                {
                  key: "status",
                  label: t("common.status"),
                  options: [
                    { value: "all", label: t("common.allStatuses") },
                    ...BILLING_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
                  ],
                },
                {
                  key: "month",
                  label: t("common.month"),
                  options: [
                    { value: "all", label: t("common.allMonths") },
                    ...MONTHS.map((month) => ({ value: month, label: monthName(Number(month), language) })),
                  ],
                },
                {
                  key: "year",
                  label: t("common.year"),
                  options: [
                    { value: "all", label: t("common.allYears") },
                    ...availableYears.map((year) => ({ value: year, label: yearLabel(Number(year), language) })),
                  ],
                },
              ]}
              values={{ status: statusFilter, month: monthFilter, year: yearFilter }}
              onApply={(values) => {
                setStatusFilter((values.status as BillingStatus | "all") ?? "all");
                setMonthFilter(values.month ?? "all");
                setYearFilter(values.year ?? "all");
                setPage(1);
              }}
            />
```

(`t("common.year")` is the key added in Task 1, Step 1-2 — confirm Task 1 is already complete before this task, since the field's label depends on it.)

(This also fixes Task 6's Invoices year field, which needs the same label.)

- [ ] **Step 3: Remove now-unused `Select` imports if nothing else on the page uses them**

Same check as Task 3 Step 3 — in this file, confirm no other `<Select>` usage remains (there isn't one), then remove the `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` import line.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/billing/BillingPage.tsx
git commit -m "feat: replace Billing status/month/year filters with FilterButton popup"
```

---

## Task 6: Wire `FilterButton` into Invoices

**Files:**
- Modify: `src/features/invoices/InvoicesPage.tsx`

**Interfaces:**
- Consumes: `FilterButton` (Task 2). `MONTHS`, `availableYears`, `monthFilter`/`setMonthFilter`, `yearFilter`/`setYearFilter`, `t`, `language`, `monthName`, `yearLabel` (all already defined/imported in this file). `t("common.year")` (added by Task 1) is used as the year field's label.

- [ ] **Step 1: Add the import**

```tsx
import { FilterButton } from "@/components/common/FilterButton";
```

- [ ] **Step 2: Replace the two inline `Select`s with one `FilterButton`**

Find (lines 133-170, the two `<Select>...</Select>` blocks for month, year):
```tsx
            <Select
              value={monthFilter}
              onValueChange={(value) => {
                setMonthFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allMonths")}</SelectItem>
                {MONTHS.map((month) => (
                  <SelectItem key={month} value={month}>
                    {monthName(Number(month), language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={yearFilter}
              onValueChange={(value) => {
                setYearFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allYears")}</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {yearLabel(Number(year), language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
```

Replace with:
```tsx
            <FilterButton
              fields={[
                {
                  key: "month",
                  label: t("common.month"),
                  options: [
                    { value: "all", label: t("common.allMonths") },
                    ...MONTHS.map((month) => ({ value: month, label: monthName(Number(month), language) })),
                  ],
                },
                {
                  key: "year",
                  label: t("common.year"),
                  options: [
                    { value: "all", label: t("common.allYears") },
                    ...availableYears.map((year) => ({ value: year, label: yearLabel(Number(year), language) })),
                  ],
                },
              ]}
              values={{ month: monthFilter, year: yearFilter }}
              onApply={(values) => {
                setMonthFilter(values.month ?? "all");
                setYearFilter(values.year ?? "all");
                setPage(1);
              }}
            />
```

- [ ] **Step 3: Remove now-unused `Select` imports if nothing else on the page uses them**

Same check — in this file, confirm no other `<Select>` usage remains, then remove the `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` import line.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/invoices/InvoicesPage.tsx
git commit -m "feat: replace Invoices month/year filters with FilterButton popup"
```

---

## Task 7: Lint pass and manual smoke check

**Files:** none (verification only).

- [ ] **Step 1: Run the linter**

Run: `npm run lint`
Expected: no new warnings/errors introduced by this plan's changes (pre-existing warnings in untouched files are not this plan's concern).

- [ ] **Step 2: Final type-check**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Leave the manual browser check to the user**

This plan does not include a browser-screenshot verification pass. Note in the final report that the user should open Rooms, Tenants, Billing, and Invoices themselves, click the new "ตัวกรอง" button on each, confirm the popup shows the right fields with the right options, confirm Clear/Confirm behave as described, and confirm the badge count updates correctly — rather than the implementer spending time on an automated screenshot pipeline for this plan.
