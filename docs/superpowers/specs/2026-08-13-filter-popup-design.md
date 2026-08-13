# Design: Single Filter Button + Popup (Replace Inline Filter Dropdowns)

Date: 2026-08-13
Status: Approved by user, ready for implementation planning

## Problem

Four pages (Rooms, Tenants, Billing, Invoices) each hand-roll their own toolbar row of `SearchInput` + one or more `Select` filter dropdowns, laid out inline (`flex flex-col gap-3 sm:flex-row sm:items-center`). On Billing (3 selects + search) this row gets long at `sm+` widths with no collapsing. The user wants this replaced everywhere with a single "ตัวกรอง" (Filter) button next to the search box; clicking it opens a popup listing every filter field for that page, with "ล้างค่า" (Clear) and "ยืนยัน" (Confirm) actions — matching a provided mobile screenshot, but applied at every screen size (not just mobile).

## Current State (verified against the code, 2026-08-13)

No page factors its toolbar into a shared component — each hand-rolls identical-shaped JSX. Exact current filter fields per page:

- **Rooms** (`src/features/rooms/RoomsPage.tsx:131-160`): `searchQuery` (text) + `statusFilter` (`RoomStatus | "all"`, options: available/occupied/maintenance/inactive via `t(\`status.${status}\`)`).
- **Tenants** (`src/features/tenants/TenantsPage.tsx:116-145`): `searchQuery` + `statusFilter` (`TenantStatus | "all"`, options: active/inactive).
- **Billing** (`src/features/billing/BillingPage.tsx:209-276`): `searchQuery` + `statusFilter` (`BillingStatus | "all"`, options: draft/issued/paid/overdue) + `monthFilter` (`"all" | "01".."12"`, labelled via `monthName()`) + `yearFilter` (`"all" | <year>`, options built from `availableYears`, labelled via `yearLabel()`).
- **Invoices** (`src/features/invoices/InvoicesPage.tsx:123-171`): `searchQuery` + `monthFilter` + `yearFilter` (same shape as Billing's).

All four pages' filter state is plain `useState` at the page level (`statusFilter`, `monthFilter`, `yearFilter`), read directly by each page's own `useMemo`-computed filtered list (`filteredRooms`, `filteredTenants`, `filteredRecords`, `filteredInvoices`). Each `Select`'s `onValueChange` currently also resets `setPage(1)`. Each page's "no results" `EmptyState` has a "Clear search" action that resets `searchQuery` and every filter `useState` back to `"all"`/`""`.

Existing i18n keys already cover every field label and option needed (`common.status`, `common.month`, `common.allStatuses`, `common.allMonths`, `common.allYears`, `status.*`, and each page's own title strings) — see `src/i18n/translations/{en,th}.ts`. `common.confirm` already exists (`"Confirm"` / `"ยืนยัน"`) and matches the mockup's confirm button exactly. No key exists yet for the Filter button label itself or the "Clear" action inside the popup (distinct from the existing `common.clearSearch`, which clears search + filters together from the empty state).

No Dialog/Sheet/Popover is used anywhere in the app as a multi-field filter panel today — `Dialog` is used only for forms, `Sheet` only for detail drawers + mobile nav, `Popover` only inside the date picker. `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` (`src/components/ui/dialog.tsx`) and `Badge` (`src/components/ui/badge.tsx`) already exist and are reused as-is; a `Label` component (`src/components/ui/label.tsx`) already exists too.

## Decisions

- **One new shared component: `FilterButton`, at `src/components/common/FilterButton.tsx`** (same folder as `SearchInput`, `Pagination`, `PageHeader`, `EmptyState`). Self-contained: owns its own `open` (Dialog open/closed) and `draft` (in-popup, not-yet-applied field values) state internally via `useState`, using `DialogTrigger`/`Dialog` in the standard uncontrolled-open pattern (a first for this codebase — every other `Dialog` usage is externally controlled — justified here because nothing outside `FilterButton` ever needs to open/close it programmatically).
- **Config-driven, no new field types.** Every filter field across all four pages is a single-select dropdown, so `FilterButton` supports exactly one field shape:
  ```ts
  interface FilterFieldOption { value: string; label: string }
  interface FilterField { key: string; label: string; options: FilterFieldOption[] }
  interface FilterButtonProps {
    fields: FilterField[];
    values: Record<string, string>;   // currently-applied values, keyed by field.key
    onApply: (values: Record<string, string>) => void;
  }
  ```
  No new field types (date range, multi-select, etc.) are introduced — out of scope, matches "use the fields that already exist."
- **Search input is untouched.** It stays inline next to the button, still applies on every keystroke exactly as today. Only the `Select` filter(s) move into the popup.
- **Apply-on-confirm, not live.** Opening the popup seeds `draft` from the `values` prop (the currently-applied state). Changing a `Select` inside the popup only updates `draft` — it does not call `onApply` and does not affect the page's filtered list until "ยืนยัน" is clicked, which calls `onApply(draft)` and closes the dialog. Closing the dialog any other way (Escape, overlay click, X button) discards the draft with no side effect, matching normal Dialog behavior.
- **"ล้างค่า" (Clear) resets the popup's fields to `"all"` for every field and stays open** (does not call `onApply`, does not close the dialog) — the user still has to click "ยืนยัน" to apply the cleared state. This matches the two-button layout in the mockup (Clear is the outline/secondary button, Confirm is the primary button, same left-to-right order as every existing `DialogFooter` in this codebase: secondary action first, primary action second).
- **Badge shows active-filter count.** `FilterButton` computes `fields.filter(f => values[f.key] && values[f.key] !== "all").length` from the applied `values` prop (not the draft) and renders it as a small `Badge` (existing component, `variant="default"`, restyled via `className` to a circular corner badge) absolutely positioned on the trigger button's corner — hidden entirely when the count is `0`.
- **No changes to filtering logic.** Each page keeps its existing `statusFilter`/`monthFilter`/`yearFilter` `useState`s and existing `useMemo` filter chains untouched. Each page's toolbar JSX changes only to: build the `fields` array (labels/options from data already computed on that page — `ROOM_STATUSES`, `BILLING_STATUSES`, `MONTHS`, `availableYears`, etc.), pass `values={{ status: statusFilter, month: monthFilter, ... }}`, and implement `onApply` as one function that calls each page's existing individual setters (plus the existing `setPage(1)`) — e.g. for Billing: `onApply={(v) => { setStatusFilter(v.status as BillingStatus | "all"); setMonthFilter(v.month); setYearFilter(v.year); setPage(1); }}`. The "Clear search" `EmptyState` action on every page is unchanged (it already resets the same `useState`s directly).
- **New i18n keys (both `en.ts` and `th.ts`, under `common`):**
  - `filter`: `"Filter"` / `"ตัวกรอง"` — used as both the button label and the popup's `DialogTitle`.
  - `clearFilters`: `"Clear"` / `"ล้างค่า"` — the popup's Clear button (distinct from the existing `clearSearch`, which is the empty-state action that clears search text too).
  - `common.confirm` (already exists) is reused for the popup's Confirm button — no new key needed there.
- **Applies at every breakpoint**, per the user's explicit choice — the inline `Select`(s) are removed from all four toolbars entirely, not just hidden below a breakpoint. The toolbar row becomes just `SearchInput` + `FilterButton`, so the existing `flex flex-col gap-3 sm:flex-row sm:items-center` wrapper on each page needs no width-management changes (it now holds only two children instead of two-to-four).
- **Popup width:** `DialogContent` gets `className="sm:max-w-md"` (narrower than the default `max-w-lg` used by form dialogs) since it never holds more than 3 short fields.

## Changed Files

- **Create:** `src/components/common/FilterButton.tsx` — the component described above.
- **Modify:** `src/i18n/translations/en.ts`, `src/i18n/translations/th.ts` — add `common.filter`, `common.clearFilters`.
- **Modify:** `src/features/rooms/RoomsPage.tsx` — replace the inline status `Select` (lines 141-159) with one `FilterButton` (1 field: status).
- **Modify:** `src/features/tenants/TenantsPage.tsx` — replace the inline status `Select` (lines 126-144) with one `FilterButton` (1 field: status).
- **Modify:** `src/features/billing/BillingPage.tsx` — replace the three inline `Select`s (lines 219-275) with one `FilterButton` (3 fields: status, month, year).
- **Modify:** `src/features/invoices/InvoicesPage.tsx` — replace the two inline `Select`s (lines 133-170) with one `FilterButton` (2 fields: month, year).
- **No changes to:** any repository, hook, filtering `useMemo` logic, `Pagination`, `SearchInput`, table/card components, or any other page (Dashboard and Settings have no search/filter toolbar today and are not in scope).

## Out of scope

- Adding any filter field that doesn't already exist on a page today.
- Any change to how search text filtering works.
- A `useFilterFields` hook or similar abstraction beyond the one `FilterButton` component — four call sites is not enough to justify more structure than passing a `fields` array.
- Automated tests (this repo has none; verification is manual/visual, same as the mobile-responsiveness audit).
