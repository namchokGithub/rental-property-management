# Design: Soft Delete for Rooms, Tenants, and Billing Records

Date: 2026-08-13
Status: Approved by user, ready for implementation planning

## Problem

Deleting a room, tenant, or billing record currently calls Firestore's `deleteDoc()` — the document is gone permanently, with no recovery path short of restoring a full database backup. This is a real risk for an admin-only-write, no-backend app: a mis-click destroys data with no undo. The app should retain deleted documents (hidden from the UI) instead of erasing them, so a mistaken delete is at worst recoverable by hand later.

## Current State (verified against the code, 2026-08-13)

- Three delete flows exist in the UI today, each going through `ConfirmDialog` then a repository `delete(propertyId, id)` call: Rooms (`RoomsPage.tsx` → `useRooms().deleteRoom` → `roomRepository.delete`), Tenants (`TenantsPage.tsx` → `useTenants().deleteTenant` → `tenantRepository.delete`), Billing (`BillingPage.tsx` → `useBillingRecords().deleteBilling` → `billingRepository.delete`).
- `src/data/repositories/firestoreCrud.ts` — `createFirestoreCrudRepository<TDoc, TCreateInput, TUpdateInput>(subcollectionName)` is a generic factory used by `roomRepository` and `tenantRepository`. Its `getAll()`/`subscribe()` map every document in the subcollection unfiltered via a shared `toDoc(id, data)` helper; its own `delete()` does a plain `deleteDoc`.
- `roomRepository.ts` / `tenantRepository.ts` each spread the factory's CRUD then override `delete()` to first call `assertNoActiveAssignment(propertyId, id)` (queries `assignments` for an active row referencing this room/tenant, throws `RoomHasActiveAssignmentError`/`TenantHasActiveAssignmentError` if found) before the `deleteDoc`. This guard must be preserved unchanged.
- `billingRepository.ts` is hand-written (no factory) because create/update/reissue need `runTransaction()`. Its `subscribe()` maps every document in the `billing` subcollection unfiltered via `toBillingRecord(id, data)`. `delete()` is a plain `deleteDoc`. Separately, `create()` guards "one bill per room per month" via the deterministic doc ID (`` `${roomId}_${billingMonth}` ``) and a transactional `existing.exists()` check; `nextInvoiceNumber()` computes `INV-YYYY-MM-NNN` by scanning all `billing` docs for the target month via its own `getDocs(query(...))` call, independent of `subscribe()`.
- `src/types/room.ts`, `src/types/tenant.ts`, `src/types/billing.ts` have no `deletedAt` (or equivalent) field today.
- Every hook (`useRooms`, `useTenants`, `useBillingRecords`) is a thin pass-through: `subscribe()` populates `useState`, and `createX`/`updateX`/`deleteX` call the matching repository method with no extra logic. No page, dashboard aggregate, search filter, or the `/invoices/:id` print page (`InvoicePrintPage.tsx`, which finds its record via `records.find((r) => r.id === id)` against the same live-loaded `records` array) reads Firestore independently of these three hooks.
- `firestore.rules`: `rooms` and `tenants` each grant `allow write: if isAdminForProperty(propertyId)` (a blanket grant covering create/update/delete together). `billing` splits `allow create, delete: if isAdminForProperty(propertyId)` from a separate `allow update: if isAdminForProperty(propertyId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly([...an explicit field allowlist...])`.
- `firestore.indexes.json` only declares composite indexes for `assignments` queries; no index touches `rooms`, `tenants`, or `billing`.
- Confirmed pre-existing project convention (`context.md`): "every list page still loads its entire collection via an unfiltered `onSnapshot` and filters/searches client-side" — there is no precedent anywhere in this codebase for a server-side (Firestore `where`) list filter.

## Decisions

- **Scope: rooms, tenants, billing only.** These are the three entities with an actual delete button today. Other Charge Masters keep their existing `isActive` toggle (already a soft-delete-equivalent for that entity) untouched — not in scope.
- **Field: `deletedAt: Timestamp | null` (Firestore) / `string | null` (domain type, ISO via the existing `timestampToIso` converter), no `deletedBy`.** A "who deleted it" audit trail is deliberately not built — there's no restore/trash UI yet to consume it, and adding an unused field would be speculative. Can be added later without a migration if ever needed, since existing docs simply won't have the field.
- **Delete becomes an update, not a delete.** `roomRepository.delete()` / `tenantRepository.delete()` / `billingRepository.delete()` change their final call from `deleteDoc(ref)` to `updateDoc(ref, { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })`. `assertNoActiveAssignment()` still runs first, unchanged, in the room/tenant versions.
- **Filtering happens client-side, inside the repository's read mapping — never as a Firestore `where("deletedAt", "==", null)` query.** Firestore's `==` operator does not match documents where the field is absent entirely (only documents where it's explicitly `null`), and every document created before this change has no `deletedAt` field at all. A query-level filter would silently hide 100% of existing data with no backfill mechanism available (this app has no backend and no seed/migration scripts — both were deleted during the earlier Firebase migration, by design). Client-side filtering (`.filter((d) => !d.data().deletedAt)` before mapping) has no such pitfall, requires no backfill, needs no new Firestore index, and matches the project's existing "load the collection, filter client-side" convention.
- **Filtering lives in exactly two places**, so every consumer gets it for free with zero downstream changes:
  1. `firestoreCrud.ts`'s `getAll()` and `subscribe()` (shared by `roomRepository` and `tenantRepository`).
  2. `billingRepository.subscribe()`.

  Every page, the Dashboard's aggregates, the room-number-uniqueness check (`RoomFormDialog`/`roomImportValidation.ts`, both built from the already-filtered `rooms` list), and the `/invoices/:id` print page (reads from the already-filtered `records` array) are unaffected — none of them need to know soft delete exists. A soft-deleted room's `roomNumber` becomes reusable automatically, since the deleted doc no longer appears in the list the uniqueness check scans.
- **`billingRepository.create()`'s one-bill-per-room-per-month guard is unchanged.** A soft-deleted billing document still "exists" as far as the deterministic-ID collision check is concerned, so recreating a bill for that exact room+month is still blocked. This is accepted as-is — there is no restore UI in this pass, so an admin who needs that month-slot back again would restore it by hand (Firebase Console: clear `deletedAt`) or, if truly disposable, hard-delete it there. Not solved in-app.
- **`nextInvoiceNumber()` is explicitly NOT touched.** It must keep scanning every `billing` document for the target month regardless of `deletedAt`, so a soft-deleted bill's `invoiceNumber` is never recomputed/reused by a different bill. Its query is independent of `subscribe()`, so this requires no special-casing — just discipline not to route it through the new filtered path.
- **Firestore rules are tightened, not left permissive.** Since rules are this app's only real authorization boundary (there's no backend to fall back on), closing off raw `delete` at the rules layer is treated as part of "implementing soft delete" rather than optional hardening:
  - `rooms` / `tenants`: split the current blanket `allow write` into `allow create, update: if isAdminForProperty(propertyId);` (no `delete`).
  - `billing`: change `allow create, delete: if isAdminForProperty(propertyId);` to `allow create: if isAdminForProperty(propertyId);` (drop `delete`), and add `'deletedAt'` to the existing `update` rule's `affectedKeys().hasOnly([...])` allowlist so the soft-delete write itself isn't rejected by the field allowlist.
- **No UI/wording changes.** Confirm dialogs and toasts keep saying "delete" ("ลบ") — soft delete is an implementation detail the end user is never shown. No new i18n keys.
- **Explicitly out of scope for this pass:** restore/undo UI, a "trash" or "show deleted" list view, `deletedBy` audit field, any change to `roomImportValidation.ts`'s own inline duplicate-check logic (it already reads from the pre-filtered `rooms` list, so it's correct without modification).

## Changed Files (for the implementation plan)

- `src/types/room.ts`, `src/types/tenant.ts`, `src/types/billing.ts` — add `deletedAt: string | null` to `Room`, `Tenant`, `BillingRecord`. Not added to any `Create*Input`/`Update*Input` type (never set through the normal form-submission path).
- `src/data/repositories/firestoreCrud.ts` — filter deleted docs out in `getAll()`/`subscribe()`'s mapping; convert `deletedAt` via `timestampToIso` in `toDoc()` alongside `createdAt`/`updatedAt`; update its own generic `delete()` to soft-delete (defensive — currently shadowed by both callers' overrides, but keeps the factory itself honest for any future subcollection built on it).
- `src/data/repositories/roomRepository.ts` — `delete()`'s final `deleteDoc` → `updateDoc(..., { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })`, after the unchanged `assertNoActiveAssignment` call.
- `src/data/repositories/tenantRepository.ts` — identical change, mirrored.
- `src/data/repositories/billingRepository.ts` — `subscribe()` filters deleted docs before mapping (and converts `deletedAt` in `toBillingRecord()`); `delete()`'s final `deleteDoc` → `updateDoc`. `create()` and `nextInvoiceNumber()` left untouched per the decisions above.
- `firestore.rules` — the two rule edits described above (rooms/tenants `write` split; billing `delete` removed + `deletedAt` added to the `update` allowlist).
- No changes to: any hook, any page/component, `firestore.indexes.json`, any i18n file, `context.md`'s Storage Keys/Feature Status tables get one line each noting delete is now soft (see below) but no architectural section needs rewriting beyond that.

## Documentation follow-up

- `context.md`: add a Business Rules bullet describing soft delete (mirroring the level of detail of the existing bulk-issue/reissue bullets), and update the one existing line that says "every delete (room/tenant/billing) goes through `ConfirmDialog`... " to note it's now a soft delete.
- `docs/firebase/data-model.md`: add `deletedAt` to the three affected document-model tables, and a short note under Business rules / rules description pointing at the tightened `rooms`/`tenants`/`billing` rules.
