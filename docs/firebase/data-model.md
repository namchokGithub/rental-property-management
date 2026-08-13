# Firebase / Firestore Data Model

## Scope

This describes the Firestore schema actually implemented and shipped by the direct-to-Firestore migration. There is no backend, no Cloud Functions, and no REST API — the React app reads and writes Firestore directly through `firebase/firestore`, and [firestore.rules](../../firestore.rules) is the sole authorization boundary. The corresponding TypeScript domain types live in `src/types/*.ts` (unchanged from the pre-migration app, except `RoomTenantAssignment.updatedAt`, added below); there is no separate `src/types/firestore/*` split — the same types describe both what a component renders and what a repository persists (Firestore `Timestamp` fields are converted to/from ISO strings at the repository boundary, so nothing above `src/data/repositories/*` ever sees a raw `Timestamp`).

## Collections

```text
users/{uid}
properties/{propertyId}
properties/{propertyId}/settings/general
properties/{propertyId}/rooms/{roomId}
properties/{propertyId}/tenants/{tenantId}
properties/{propertyId}/assignments/{assignmentId}
properties/{propertyId}/billing/{roomId_billingMonth}
```

`users/{uid}` uses the Firebase Authentication UID as its document ID and is top-level, since a user's access isn't scoped to any one property until you read their `propertyIds` array. Every business collection is a **subcollection** of `properties/{propertyId}` — there is no `propertyId` field duplicated inside any subcollection document, because the collection path already scopes it; that path is the single source of truth for which property a document belongs to.

There is no `invoices` collection and no `counters` collection. The Invoices page is a filtered view over `billing` records that have `invoiceNumber` set — this preserves the original pre-migration design decision (documented in [context.md](../../context.md)'s Domain Model section) that a separate Invoice entity is an unnecessary second source of truth for data `BillingRecord` already owns. Invoice numbering (`INV-YYYY-MM-NNN`) is computed inside the same transaction that issues a bill, by scanning that property/month's existing `billing` documents — see [Business rules](#business-rules) below.

Each `properties/{propertyId}` document is a property registry record used by the header's property selector. Its subcollections hold the business data. `admin` users can list and select every registered property; `staff` users can read only the individual property IDs in their profile's `propertyIds` array.

## Document models

### `users/{uid}`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | |
| `email` | `string` | Mirrors the Firebase Auth email; Firestore is still the profile source of truth for role/property access. |
| `role` | `"admin" \| "staff"` | Only `admin` can write anywhere; `staff` can read everywhere they have property access. |
| `propertyIds` | `string[]` | Staff may access only these properties. Admins may access every registered property; the array remains a default/fallback list for bootstrapping older properties. |
| `isActive` | `boolean` | `false` disables access without deleting the Auth account — `AuthContext` treats an inactive or missing profile the same as "not authorized," leaving the user on the login screen even with a valid Firebase credential. |

Written only by hand — see the README's [First-Time Setup](../../README.md#first-time-setup). No client code ever writes to `users/{uid}`; `firestore.rules` forbids it outright (`allow list, write: if false`) so a signed-in user can never grant themselves a role or property access.

### `properties/{propertyId}`

Registry document used by the property selector (`src/data/repositories/propertyRepository.ts`).

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | Displayed in the selector. |
| `address`, `phone` | `string?` | Mirrored from Settings when an admin saves property information. |
| `createdAt`, `updatedAt` | `Timestamp` | |

### `properties/{propertyId}/settings/general`

Single document per property, holding the editable property details and billing defaults (`src/types/settings.ts`'s `PropertySettings`, `src/data/repositories/settingsRepository.ts`). Saving Settings mirrors the name, address, and phone into the parent registry document.

| Field | Type | Notes |
| --- | --- | --- |
| `propertyName` | `string` | |
| `propertyAddress` | `string` | |
| `phone` | `string` | |
| `defaultElectricityRate` | `number` | Prefills new rooms and new bills. |
| `defaultWaterRate` | `number` | |
| `defaultInvoiceNote` | `string` | Snapshotted onto each bill's invoice note at creation, not re-read from Settings afterward. |
| `otherChargeMasters` | `OtherChargeMaster[]` | Embedded array — see below. Missing/absent field reads as an empty list. |

An absent document (no `Settings` ever saved for a property) reads back as `DEFAULTS` (`src/data/repositories/settingsRepository.ts`) — every field zero/empty — rather than throwing, so a freshly-bootstrapped property with only a `users/{uid}` profile and no settings doc yet still loads the Settings page without error.

#### `otherChargeMasters` (embedded, not a subcollection)

Reusable per-bill charge templates (garbage fee, parking, etc.) — a handful to a few dozen rows, edited rarely, only from the Settings page. Stored as a plain array field on the same `settings/general` document rather than a `properties/{propertyId}/otherCharges/{chargeId}` subcollection: this needs no extra security-rule block, and one `onSnapshot` on the settings document gives live updates for the whole list. Each element:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | `crypto.randomUUID()`, generated client-side. |
| `nameTh` | `string` | |
| `nameEn` | `string?` | |
| `defaultAmount` | `number` | |
| `isActive` | `boolean` | Only active masters are offered when attaching a charge to a new bill. |
| `createdAt`, `updatedAt` | `string` (ISO) | These stay ISO strings, not Firestore `Timestamp`s, since they're inside an array element rather than a top-level document field — Firestore's `serverTimestamp()` sentinel cannot be used inside an array. |

Writes go through `src/data/repositories/otherChargeRepository.ts`'s `runTransaction()`-based read-modify-write on the whole array (create/update/delete), which avoids a lost update if two admins edit the list at the same moment.

### `properties/{propertyId}/rooms/{roomId}`

| Field | Type | Notes |
| --- | --- | --- |
| `roomNumber` | `string` | |
| `floor` | `string?` | |
| `type` | `string?` | |
| `monthlyRent` | `number` | |
| `status` | `"available" \| "occupied" \| "maintenance" \| "inactive"` | Never stores a tenant reference — see Business rules. |
| `description` | `string?` | |
| `electricityRate` | `number` | |
| `waterRate` | `number` | |
| `deletedAt` | `Timestamp \| null` | Soft-delete marker — see Business rules. Absent on any document created before this field existed; treated as "not deleted" either way. |
| `createdAt`, `updatedAt` | `Timestamp` | Set via `serverTimestamp()`; converted to ISO strings at read time. |

### `properties/{propertyId}/tenants/{tenantId}`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | Single free-text field, not split first/last (the pre-Firebase `fullName`/`.name` mismatch was fixed before this migration started). |
| `phone`, `email`, `identificationNumber`, `address`, `emergencyContactName`, `emergencyContactPhone`, `notes` | `string?` | |
| `status` | `"active" \| "inactive"` | Describes the tenant record, not occupancy. |
| `deletedAt` | `Timestamp \| null` | Soft-delete marker — see Business rules. |
| `createdAt`, `updatedAt` | `Timestamp` | |

### `properties/{propertyId}/assignments/{assignmentId}`

| Field | Type | Notes |
| --- | --- | --- |
| `roomId` | `string` | |
| `tenantId` | `string` | |
| `startDate` | `Timestamp` | |
| `endDate` | `Timestamp \| null` | |
| `status` | `"active" \| "ended"` | The **only** source of truth for which tenant occupies which room. |
| `createdAt` | `Timestamp` | |
| `updatedAt` | `Timestamp` | Not read for any business logic directly, but written on every assign/end so the document changes on each transaction — this gives Firestore's optimistic-concurrency check something to serialize two simultaneous assignment attempts for the same tenant against (see Business rules). |

### `properties/{propertyId}/billing/{roomId_billingMonth}`

Document ID is deterministic: `` `${roomId}_${billingMonth}` `` — this is what makes "at most one bill per room per month" a Firestore-enforced invariant (a second `create` against the same ID contends with the first inside a transaction) rather than something only the UI checks.

| Field | Type | Notes |
| --- | --- | --- |
| `roomId` | `string` | |
| `tenantId` | `string \| null` | A room can be billed with no active tenant. |
| `invoiceNumber` | `string \| null` | Set only at issuance; never re-assigned afterward. |
| `billingMonth` | `string` | `"YYYY-MM"`. |
| `electricity`, `water` | `{ previousMeter, currentMeter, usage, rate, amount }` | |
| `rentAmount` | `number` | |
| `otherCharges` | `{ id, masterId?, name, amount }[]` | Snapshot at the time each charge was added to this bill — editing/deactivating the source `OtherChargeMaster` later never changes a past bill. |
| `subtotal`, `total` | `number` | |
| `status` | `"draft" \| "issued" \| "paid" \| "overdue"` | `"overdue"` is never persisted — see Business rules. |
| `issuedAt`, `dueDate`, `paidAt` | `Timestamp \| null` | |
| `deletedAt` | `Timestamp \| null` | Soft-delete marker — see Business rules. `nextInvoiceNumber()`'s month scan deliberately ignores this field, since a deleted bill's invoice number must never be reused. |
| `createdAt`, `updatedAt` | `Timestamp` | |

## Business rules

- **Assignment exclusivity.** `assignmentRepository.assign()` runs inside a `runTransaction()`: it checks (via query) that neither the target room nor the target tenant already has an active assignment, creates the new assignment document, flips the room to `occupied`, and writes a no-op `updatedAt` touch on the tenant document purely to force Firestore's optimistic-concurrency check to serialize two simultaneous `assign()` calls for the same tenant (without that touch, both transactions could read "no active assignment" before either commits).
- **Ending a tenancy.** `assignmentRepository.endByRoomId()` (also transactional) marks the assignment `ended`, records `endDate`, and flips the room back to `available` — but only if the room's current status is still `occupied`; an explicit `maintenance`/`inactive` status is left alone, since ending occupancy shouldn't silently clear a maintenance flag.
- **Moving a tenant to a different room** calls `endTenancyByRoomId()` then `assignTenant()` sequentially (two separate transactions, not one) — matching the pre-Firestore behavior exactly; a crash between the two calls could leave a tenant unassigned, which is a pre-existing, documented, non-regressed limitation.
- **Deleting a room or tenant with an active assignment is rejected** (`RoomHasActiveAssignmentError`/`TenantHasActiveAssignmentError`, thrown by `roomRepository.delete()`/`tenantRepository.delete()` after an `assignments` query) — ended assignment history never blocks deletion and is never cascade-deleted.
- **Delete is soft, for rooms, tenants, and billing.** `delete()` on all three repositories sets `deletedAt: serverTimestamp()` (plus `updatedAt`) instead of calling `deleteDoc` — the document is retained, just filtered out client-side by `getAll()`/`subscribe()` before it reaches any hook/page. Deliberately **not** a Firestore `where("deletedAt", "==", null)` query: `==` never matches a document where the field is absent entirely, and every document that existed before this field was added has no `deletedAt` at all — a query-level filter would hide all of it with no backfill mechanism available (no backend, no migration scripts). `billingRepository`'s invoice-number sequencing (`nextInvoiceNumber()`) and one-bill-per-room-per-month guard (`create()`'s deterministic-ID collision check) both deliberately ignore `deletedAt` — see the field notes above. `firestore.rules` was tightened alongside this: `rooms`/`tenants` grant `create, update` only (no `delete`), and `billing` dropped its `delete` permission and added `deletedAt` to its `update` allowlist — since rules are the only real enforcement here, removing the client's soft-delete call without also removing the raw-delete grant would leave hard delete one direct-SDK-call away. No restore/trash UI and no `deletedBy` audit field exist yet (see [the soft-delete design doc](../superpowers/specs/2026-08-13-soft-delete-design.md)).
- **Invoice numbering.** `billingRepository.update()` assigns `invoiceNumber` inside a `runTransaction()` only on the transition into `status: "issued"`: it queries existing `billing` documents for the same `billingMonth`, filters to ones that already have an `invoiceNumber`, and calls the unchanged pure `generateInvoiceNumber()` (`src/lib/invoice.ts`) to compute `INV-YYYY-MM-NNN`. Bulk-issuing must `await` each record sequentially (never `Promise.all`) so each transaction's write commits before the next one reads — see `BillingPage.tsx`'s `handleBulkIssue()`.
- **Billing status lifecycle.** Stored `status` changes only via explicit user actions (issue, mark paid); `"overdue"` is never persisted — `resolveBillingStatus()` (`src/lib/invoice.ts`, unchanged) computes it at read time from `dueDate`.
- **Firestore rules also enforce billing immutability after issuance**: once `invoiceNumber` is set, an `update` that changes `invoiceNumber` or `issuedAt` is rejected outright (see [firestore.rules](../../firestore.rules)'s `billing` match block) — the closest a client-only rule can get to the immutability guarantee a real backend's separate `invoices` collection would have given for free.
- **Role enforcement.** `role: "admin"` can write anywhere the user has property access; `role: "staff"` can only read. This is enforced by [firestore.rules](../../firestore.rules) — the actual authorization boundary — and mirrored client-side as a UX convenience (hidden create/edit/delete buttons for `staff`, see `src/features/*/[Page|Table].tsx`).

## Known limitation: no server-enforced cross-document invariants

Since there is no backend, Firestore Security Rules are the only thing stopping a malicious *admin*-role account from writing directly via the SDK and bypassing a transaction's invariant checks — e.g. writing two `"active"` assignments for one room by calling `setDoc` directly instead of going through `assignmentRepository.assign()`. The rules catch property/role boundary violations but cannot cheaply inspect sibling documents to catch every cross-document business invariant a transactional backend would have enforced. This is an accepted trade-off of a client-only architecture, not an oversight.

## Indexes

`firestore.indexes.json` declares two composite indexes, both used only inside the transactional `runTransaction()` calls above (every list page still loads its entire collection via an unfiltered `onSnapshot` and filters/searches client-side, so ordinary reads need no composite index):

```json
{
  "indexes": [
    {
      "collectionGroup": "assignments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "roomId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "assignments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

If a `FAILED_PRECONDITION: The query requires an index` error ever surfaces elsewhere, add the exact index Firestore's error message links to — don't pre-guess further ones.
