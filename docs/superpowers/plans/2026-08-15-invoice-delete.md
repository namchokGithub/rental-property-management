# Delete a Superseded Invoice Version

**Status:** Not started — plan only, implementation deferred.

## Context

Grilling session on the Invoices page (`src/features/invoices/InvoicesPage.tsx`). User wants a delete action scoped to the Invoices page only — separate from the existing whole-`BillingRecord` soft delete already on the Billing page (`BillingPage.tsx`, which stays the manual path for "delete the whole monthly bill").

Investigation found the domain model has drifted since `context.md` was written: `BillingRecord.invoices?: InvoiceSnapshot[]` (`src/types/billing.ts`) now holds a full reissue history — every `billingRepository.reissue()` call marks the previously-active entry `"superseded"` and appends a new `"issued"` entry. The Invoices page renders one row per `InvoiceSnapshot` (`invoiceRecordsFromBilling()`), not one row per `BillingRecord`. **None of this (`invoices[]`, reissue, "superseded" status) is documented in `context.md` today** — worth a separate doc-refresh pass later, out of scope for this plan.

**Decision reached (this session):** delete is only allowed on a `"superseded"` invoice row. The active/latest invoice on a bill can't be deleted directly — reissue it first (which supersedes it), then delete the now-superseded version. This sidesteps the hard question entirely: `resolveBillingStatus()`/`latestInvoiceFromBilling()` (`src/lib/invoice.ts`) always pick the invoice with the newest `issuedAt`, and a `"superseded"` entry is never the newest by construction (superseding only ever happens by creating something newer) — so deleting one can never change what a `BillingRecord`'s current/active status resolves to. No draft-reverting or other `BillingRecord`-level side effects are needed.

## Changes

### 1. `src/types/billing.ts`

Add `deletedAt?: string | null` to `InvoiceSnapshot`.

### 2. `src/data/repositories/billingRepository.ts`

New method, same transactional shape as `markInvoicePaid`:

```ts
async deleteInvoice(propertyId: string, id: string, invoiceId: string): Promise<void> {
  const ref = doc(billingCollectionRef(propertyId), id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Billing record not found");
    const currentRaw = snapshot.data() as RawBillingDoc;
    const target = currentRaw.invoices?.find((invoice) => invoice.id === invoiceId);
    if (!target) throw new Error("Invoice not found");
    if (target.status !== "superseded") throw new Error("Only a superseded invoice can be deleted");
    const invoices = currentRaw.invoices!.map((invoice) =>
      invoice.id === invoiceId ? { ...invoice, deletedAt: new Date().toISOString() } : invoice,
    );
    transaction.update(ref, { invoices, updatedAt: serverTimestamp() });
  });
},
```

Notes:
- `deletedAt` on an array element must be a client-generated ISO string, not `serverTimestamp()` — Firestore rejects the sentinel inside array elements (same constraint `context.md` already documents for `OtherChargeMaster`).
- No legacy-fallback migration call (`invoiceHistory()`) needed here — a `"superseded"` status can only exist once a bill has gone through `reissue()`, which always populates a real `invoices[]` array first. A legacy single-invoice bill (no `invoices[]` yet) never has a `"superseded"` row to delete.
- The `status !== "superseded"` check is server-trusted-transaction-side defense-in-depth — the UI only ever calls this for rows it renders as superseded, but the check stops a stale/tampered client call from deleting an active invoice.
- `nextInvoiceNumber()`'s reuse-prevention scan (`billingRepository.ts` ~line 115) reads `data.invoices` directly and is untouched by this change — it doesn't look at `deletedAt`, so a deleted invoice's number is still correctly never reused.

### 3. `src/types/billing.ts` — `invoiceRecordsFromBilling()`

Filter out deleted entries, in the one function every consumer (Invoices page list, `latestInvoiceFromBilling`, `resolveBillingStatus`) already goes through:

```ts
if (record.invoices?.length) {
  return record.invoices
    .filter((invoice) => !invoice.deletedAt)
    .map((invoice) => ({ ...invoice, billingId: record.id }));
}
```

### 4. `src/hooks/useBillingRecords.ts`

Add `deleteInvoice` alongside the existing `deleteBilling`/`markInvoicePaid` callbacks:

```ts
const deleteInvoice = useCallback(
  (id: string, invoiceId: string) => billingRepository.deleteInvoice(propertyId, id, invoiceId),
  [propertyId],
);
```

Include it in the hook's returned object.

### 5. `src/features/invoices/InvoicesPage.tsx`

- Destructure `deleteInvoice` from `useBillingRecords()`.
- Add `deletingInvoice: InvoiceRecord | undefined` state.
- Row actions (both the desktop table's action cell and the mobile card): add a delete icon button, shown only when `isAdmin && record.status === "superseded"` — same visibility pattern already used for the `markPaid` button (`isAdmin && (resolveInvoiceStatus(record) === "issued" || ...)`).
- Reuse `ConfirmDialog` (already the shared pattern for every delete flow in this app — Rooms/Tenants/Billing) with `destructive`, confirming then calling `deleteInvoice(record.billingId, record.id)`, toast on success/failure, matching the existing `RoomsPage.tsx` delete-flow shape exactly.
- No change needed to `firestore.rules` — `invoices` is already in the `billing` document's `update` allowlist (`firestore.rules:73-77`), and this write only mutates that same field.

### 6. i18n keys (`src/i18n/types.ts`, `translations/en.ts`, `translations/th.ts`)

Under `invoice.*`: `deleteInvoice` (button/tooltip label), `deleteConfirmTitle`, `deleteConfirmDescription` (mention it only removes this superseded version, not the bill), `deletedToast`.

### 7. `context.md`

Add a short note under Domain Model / Business Rules: superseded invoice versions can be individually soft-deleted from the Invoices page (`InvoiceSnapshot.deletedAt`); the active/latest invoice and the underlying `BillingRecord` are untouched by this action.

## Verification

- `pnpm build` (typecheck + production build — no automated test suite in this repo, per `context.md`'s Known Limitations).
- `pnpm lint`.
- Manual smoke test against the Firebase Emulator Suite:
  - Issue a bill, reissue it once (creates one `"superseded"` + one `"issued"` row on the Invoices page).
  - Confirm no delete action appears on the active `"issued"` row.
  - Delete the `"superseded"` row — confirm it disappears from the Invoices list, the active row's status/total is unaffected, and the Billing page's row for that month still shows the bill untouched.
  - Reissue again (second time) — confirm the deleted invoice's old number is never reused for the new invoice number.
