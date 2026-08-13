# Design: Mobile Responsiveness Audit & Fix (Whole App)

Date: 2026-08-13
Status: Approved by user, ready for implementation planning

## Problem

`context.md` marks "Responsive — Done", verified at 375/768/1024/1440px, but only documents a confirmed table→card mobile pattern for the Billing page. Rooms, Tenants, Invoices, Dashboard, and Settings have some `sm:`/`md:`/`lg:` Tailwind usage already, but no confirmed visual verification. The user has no specific bug report — they want a fresh, full visual audit of every page on mobile, and any issue found fixed to match the Billing page's existing quality bar.

## Current State (verified against the code, 2026-08-13)

- Stack: Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`), shadcn/ui components over Radix primitives, `class-variance-authority` + `clsx` + `tailwind-merge` for variants, `lucide-react` icons. No CSS Modules, no MUI/Chakra, no CSS-in-JS.
- Layout shell: `src/app/AppLayout.tsx` (sidebar + header + main). `src/components/layout/AppSidebar.tsx` is a fixed 240px `<aside>` hidden below `md`. `src/components/layout/AppHeader.tsx` shows a `md:hidden` hamburger that opens the same nav items in a Radix `Sheet` drawer. This nav pattern is already confirmed working and is out of scope for changes — only used as-is.
- Routes (`src/app/router.tsx`, hash router): `/dashboard`, `/rooms`, `/tenants`, `/billing`, `/invoices`, `/settings` all nested in `AppLayout`; `/invoices/:id` (`InvoicePrintPage.tsx`) is standalone (no sidebar/header, has its own `@media print` styles) and is excluded — it's a print target, not a navigated mobile screen.
- Existing responsive breakpoint usage (grep counts): `RoomImportDialog.tsx` (10), `InvoicesPage.tsx` (7), `DashboardPage.tsx` (6), `BillingPage.tsx` (6), `TenantFormDialog.tsx` / `BillingFormDialog.tsx` (5 each), `AppSidebar.tsx` (5), `TenantsPage.tsx` / `RoomsPage.tsx` (4 each), plus shadcn `ui/dialog.tsx`, `ui/sheet.tsx`, `ui/button.tsx`, `common/Pagination.tsx`, `common/PageHeader.tsx`.
- Only Billing has a confirmed table→card breakpoint pattern per `context.md` and `README.md`.
- No `useMediaQuery` hook or JS-level breakpoint logic exists outside `ThemeContext.tsx`'s unrelated dark-mode `matchMedia` check.

## Decisions

- **Method: visual audit via running dev server + browser screenshots**, not code review alone. Responsive bugs (overflow, wrapping, overlap, clipped touch targets) are only reliably caught by rendering, matching the methodology `context.md` already used for Billing.
- **Viewports: 375px, 768px, 1024px.** Skip 1440px — desktop is already confirmed working and out of scope for this pass.
- **Scope: all six routed pages under `AppLayout`** — Dashboard, Rooms, Tenants, Billing, Invoices, Settings — plus the dialogs/sheets/forms each page opens (e.g. `RoomFormDialog`, `TenantFormDialog`, `BillingFormDialog`, `RoomImportDialog`, any confirm dialogs). `InvoicePrintPage.tsx` (`/invoices/:id`) is excluded — it's a print-oriented standalone view, not part of normal mobile navigation.
- **Fix immediately, no per-issue approval.** Every issue found during the audit gets fixed in the same pass; the user does not want to review/approve each fix individually.
- **Target pattern: match Billing's existing quality bar** — table→card collapse under `md` where a page shows a data table, no horizontal page scroll, no clipped/overlapping controls, forms/dialogs usable at 375px width.
- **No changes to:** the sidebar/header nav drawer mechanism (already confirmed working, not touched), the design system/component library choice, breakpoint values (`sm`/`md`/`lg` stay as Tailwind defaults — no new custom breakpoints), desktop (`lg`+) layout.
- **Out of scope:** `InvoicePrintPage.tsx`, any non-UI/backend logic, adding automated visual-regression tests (this is a one-time audit-and-fix pass, not new tooling).

## Process

1. Start the dev server (or use the `run` skill's existing pattern for this project).
2. For each of the 6 in-scope pages, screenshot at 375px, 768px, 1024px, including opening at least one dialog/form per page where applicable.
3. Note every visual defect per page/viewport (overflow, wrap, overlap, clipped/too-small touch targets, unreadable table on narrow screens).
4. Fix defects directly in the corresponding page/component, following the existing Tailwind/shadcn conventions already used in the codebase (e.g. the table→card pattern already implemented in Billing, reused/adapted for other tables rather than inventing a new pattern).
5. Re-screenshot fixed pages/viewports to confirm the fix.

## Documentation follow-up

- `context.md`: update the "Responsive — Done" note to reflect that all pages (not just Billing) now have a confirmed table→card (or equivalent) mobile pattern, if that's what the audit finds is needed.
