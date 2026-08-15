# Reduce Firestore Read Amplification + Guard Repeated Clicks

**Status:** Not started — implementation deferred, plan only.

## Context

Grilling session on `context.md` (proactive hardening, not reactive — no quota errors hit yet). Target scale: 1 property, ~50 rooms, but users are elderly and expected to click/refresh/navigate more than average. Three concrete gaps were confirmed directly against the code (not hypothetical):

1. `src/lib/firebase/firestore.ts` calls plain `getFirestore(app)` — no local persistence. Every domain hook (`useRooms`, `useTenants`, `useAssignments`, `useBillingRecords`, `useSettings`, `useOtherCharges`) subscribes via `onSnapshot` inside a `useEffect` scoped to the page component that calls it. Navigating away and back, or hitting F5, unmounts/remounts the hook → full collection re-read from the server every time, with no cache to fall back on.
2. `src/components/common/ConfirmDialog.tsx` (used by every delete flow in Rooms/Tenants/Billing/OtherCharge) renders `AlertDialogAction`, which Radix implements as `DialogPrimitive.Close` (verified in `node_modules/.../@radix-ui/react-alert-dialog/dist/index.mjs:81-86`, `.../@radix-ui/react-dialog/dist/index.mjs:283`: `onClick: composeEventHandlers(props.onClick, () => context.onOpenChange(false))`). This means the dialog **always auto-closes the instant Confirm is clicked**, regardless of whether the passed `onConfirm` (already `async` at every call site) has finished. The user gets no in-flight feedback, which is exactly the kind of gap that causes an impatient/uncertain user to re-open and re-confirm the same action.
3. `src/features/billing/BillingPage.tsx`'s `handleBulkIssue` (the "Issue Selected" bulk-issue button, ~line 136-175) has no pending/disabled guard at all while its documented-as-required sequential `for...of` loop is running. A second click mid-loop starts a fully independent second pass over the same selected ids, defeating the sequential-transaction invariant the code comment explicitly calls out.

Goal: close all three gaps without reversing any documented architecture decision (state strategy, no-app-wide-Context-for-business-data, soft delete, etc.), and record the one genuinely trade-off-bearing decision (persistence + multi-tab) as an ADR.

## Changes

### 1. `docs/adr/0005-firestore-persistent-local-cache.md` (new)

```md
# Firestore persistent local cache with multi-tab support

Client hooks (useRooms, useBillingRecords, ฯลฯ) subscribe onSnapshot ต่อ component mount โดยไม่มี local cache
ข้าม reload — ทุกครั้งที่สลับหน้าหรือกด F5 คือโหลดทั้ง collection ใหม่จาก server. เปลี่ยนมาใช้
`initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`
เพื่อให้ข้อมูลค้างใน IndexedDB ข้าม reload/tab — ลด read เวลาผู้ใช้สลับหน้า/refresh ถี่. เลือก multi-tab manager
แทน default single-tab เพราะผู้ใช้อาจเผลอเปิดซ้ำหลาย tab โดยไม่ตั้งใจ — single-tab จะ silently fallback เป็น
memory-only cache ใน tab ที่ 2 ขึ้นไป (ไม่ error แต่เสียประโยชน์ persistence ไปเงียบๆ).

## Considered Options
- Lift onSnapshot subscriptions to a top-level provider instead — rejected: reverses the documented
  "no app-wide Context for business data" state strategy, doesn't help F5 refresh anyway.
- Default single-tab persistence — rejected: silently degrades to memory-only in additional tabs.
```

### 2. `src/lib/firebase/firestore.ts`

Replace `getFirestore(app)` with `initializeFirestore`, using the confirmed v12 API (`node_modules/.pnpm/@firebase+firestore@4.17.0.../dist/index.d.ts:1581,2226,2237`):

```ts
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { app } from "@/lib/firebase/app";

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

`connectFirestoreEmulator(db, ...)` in `emulators.ts` still works unchanged — it just repoints an existing `Firestore` instance, regardless of how it was created. One real dev-workflow caveat to call out once this ships: after resetting/reimporting emulator data, a dev's browser may still show stale cached documents until IndexedDB is cleared (Application tab → Clear storage, or an incognito window) — this doesn't affect production users, only local development against the emulator.

### 3. `src/components/common/ConfirmDialog.tsx`

Prevent the Radix auto-close until the (already-async at every call site) `onConfirm` resolves, and disable both buttons while pending — same convention as `isSubmitting` in the form dialogs (`RoomFormDialog.tsx:173-178`, no spinner, just `disabled`):

```tsx
const [isPending, setIsPending] = useState(false);

async function handleConfirm(event: Event) {
  event.preventDefault(); // stops AlertDialogAction's built-in auto-close (Dialog.Close composeEventHandlers)
  if (isPending) return;
  setIsPending(true);
  try {
    await onConfirm();
  } finally {
    setIsPending(false);
  }
}
```

- `AlertDialogAction onClick={handleConfirm} disabled={isPending} ...>`
- `AlertDialogCancel disabled={isPending}>`
- Widen the prop type: `onConfirm: () => void | Promise<void>` (every current call site already passes an `async () => {...}`, so no call-site changes needed).
- No forced `onOpenChange(false)` inside `ConfirmDialog` itself — every existing call site already clears its own `open` state on success inside `onConfirm` (e.g. `setDeletingRoom(undefined)` in `RoomsPage.tsx:297`). Leaving that alone means a failed `onConfirm` now correctly leaves the dialog open (today it silently closes even on error) — a natural improvement, not extra scope.

### 4. `src/features/billing/BillingPage.tsx`

Add the same `isSubmitting`-style guard to `handleBulkIssue` (~line 136) and its button (~line 175):

```tsx
const [isIssuing, setIsIssuing] = useState(false);

async function handleBulkIssue() {
  if (isIssuing) return;
  const ids = [...effectiveSelectedIds];
  if (ids.length === 0) return;
  setIsIssuing(true);
  try {
    // ...unchanged sequential for...of loop...
  } finally {
    setIsIssuing(false);
  }
}
```

Button: `<Button variant="secondary" onClick={handleBulkIssue} disabled={isIssuing}>`.

### 5. `context.md`

Per this project's own stated convention ("Update this file after any meaningful architecture or feature change"):
- Repository architecture section: note `db` is now created via `initializeFirestore` with persistent multi-tab local cache, not plain `getFirestore` (reference the new ADR).
- Business Rules → Bulk issue: note the button now guards against re-entrant clicks with `isIssuing`.
- Business Rules / Delete behavior: note `ConfirmDialog` now keeps the dialog open (and both buttons disabled) until its async confirm handler resolves, instead of closing instantly on click.

## Verification

- `pnpm build` (typecheck + production build) — this repo has no automated test suite; build + lint is the existing bar (see context.md's Known Limitations).
- `pnpm lint`
- Manual smoke test against the Firebase Emulator Suite (per existing project convention, `docs/firebase/setup.md`):
  - Load Rooms/Tenants/Billing pages, navigate away and back, confirm no visible regression and (via DevTools → Application → IndexedDB) confirm a Firestore cache database now exists.
  - Open the app in two tabs simultaneously, confirm both stay live (no "failed-precondition" persistence error in console).
  - Open a delete confirm dialog, click Confirm once, verify the dialog stays open with both buttons disabled until the toast fires, then closes.
  - Select multiple draft billing records, click "Issue Selected" twice rapidly, confirm the second click is a no-op while the first is in flight (button disabled) and only one pass of invoice numbers gets assigned.
