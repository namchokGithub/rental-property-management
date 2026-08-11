# Firebase / Firestore Data Model

## Scope and current-state fit

This is the Phase 1 target model for the current frontend-only rental application. It prepares the repository boundary for Firebase Authentication, an API/Cloud Functions layer, and Firestore, but does not install Firebase, change repositories or hooks, alter the UI, or remove `localStorage`.

The existing local models remain the active application contracts in `src/types/*.ts`. The prospective persisted Firestore contracts live separately in `src/types/firestore/*` so adding the required multi-property fields and Firestore timestamps cannot change the current UI or storage behavior. `FirestoreTimestamp` is a type-only alias for Firebase's `Timestamp`; the Firebase client setup itself is documented in `setup.md`.

Current localStorage domain keys to migrate later are `rental.rooms`, `rental.tenants`, `rental.assignments`, `rental.billing`, `rental.settings`, and `rental.otherCharges`. Authentication is currently a demo session at `rental.auth.session`; UI preferences (`app.language`, `app.appearance`, and `app.accentTheme`) are not property data and should remain client preferences.

## Collections

Use top-level collections, with a `propertyId` field on every property-scoped business document:

```text
users/{uid}
properties/{propertyId}
propertySettings/{propertyId}
rooms/{roomId}
tenants/{tenantId}
roomAssignments/{assignmentId}
otherChargeMasters/{chargeId}
billingRecords/{billingId}
```

`users/{uid}` uses the Firebase Authentication UID as its document ID. All other document IDs are generated Firestore IDs. `propertySettings/{propertyId}` deliberately shares its document ID with its property; its `propertyId` field is retained for a consistent document contract and simple converter validation.

Top-level collections are preferred over property subcollections for this project because the interface already has cross-entity list and detail views, and the likely API needs to query records by property, month, status, room, or tenant without first resolving a nested parent path. A uniform `propertyId` constraint makes authorization scope explicit, supports future staff access to several properties, and keeps repository query construction consistent. Firestore security rules and the future API must always scope property data by both `propertyId` and the caller's membership in `users/{uid}.propertyIds`.

## Document models

The corresponding TypeScript interfaces are in `src/types/firestore/`. Persisted date/time fields use Firestore `Timestamp`; no JavaScript `Date` strings are persisted in the target model.

| Collection | Type | Notes |
| --- | --- | --- |
| `properties` | `Property` | Owns the name, address, and phone currently stored in local settings. |
| `users` | `UserProfile` | Application profile only, including explicit `isActive` authorization state. Firebase Authentication owns the UID, credentials, and password handling. No password is stored here. |
| `rooms` | `Room` | Has required `propertyId`; its `status` is a query-friendly operational field, not the tenant-history source of truth. |
| `tenants` | `Tenant` | Has required `propertyId`; status describes the tenant record, not assignment history. |
| `roomAssignments` | `RoomTenantAssignment` | Keeps tenancy history, including ended assignments. |
| `otherChargeMasters` | `OtherChargeMaster` | Optional charge templates only; nothing creates a charge on a bill automatically. |
| `billingRecords` | `BillingRecord` | The financial record and invoice lifecycle source of truth. |
| `propertySettings` | `PropertySettings` | Per-property billing defaults and invoice note; it does not embed charge masters. |

`BillingRecord` retains the current model's meter readings, calculated utility amounts, rent, other charges, totals, status, due date, issue date, paid date, and invoice number. It adds `propertyId`, `roomSnapshot`, and optional `tenantSnapshot`. `BillingCharge` is an embedded snapshot with its own generated ID and optional `masterId` provenance.

### Invoice decision: derived from `BillingRecord`

Do not create an `invoices` collection in this phase. The current application already treats a record with `invoiceNumber` as an invoice: `InvoicesPage` filters billing records, marking it paid updates the same billing record, and the print page renders that same record. Its invoice number, issue date, due date, and payment status are therefore not independent from billing today.

`InvoiceProjection` in `src/types/firestore/invoice.ts` documents the read model for invoice screens. It is derived from issued billing records and is not persisted. Introduce a dedicated `invoices` collection only if a later requirement adds independent state, such as immutable legal invoice revisions, print/export audit events, payment allocation across invoices, credit notes, or a distinct numbering lifecycle. That change should be a deliberate migration, not a duplicate write now.

## Relationships and business rules

```text
Property 1 ── * Room
Property 1 ── * Tenant
Property 1 ── * OtherChargeMaster
Property 1 ── 1 PropertySettings
Room     1 ── * RoomTenantAssignment * ── 1 Tenant
Room/Tenant ── * BillingRecord
BillingRecord ── * embedded BillingCharge
```

- Every room, tenant, assignment, master charge, and bill belongs to exactly one property. Referenced room and tenant documents must belong to the same property as the dependent document.
- Assignment history is authoritative for occupancy. `Room` must not have `currentTenantId` as its only source of truth. If a future read optimization adds it, it is a denormalized cache updated atomically with the assignment, never historical authority.
- At most one active assignment may exist for a room. The current local implementation closes the prior active room assignment when assigning a new tenant and sets the room to `occupied`; ending it makes an occupied room `available`. The future API must retain this behavior in a Firestore transaction. UI eligibility also currently prevents assigning a tenant who already has an active assignment; retain that policy if it remains desired.
- `maintenance` and `inactive` rooms must not be made `available` merely because a tenancy ends.
- Room status and assignment changes must be coordinated atomically by the future API. Client Firestore writes should not be trusted to enforce this invariant.
- Currency and meter values are finite, non-negative numbers. Meter usage is `currentMeter - previousMeter`; total calculation remains in the existing calculation domain service, then its result is persisted.
- `billingMonth` is a required `YYYY-MM` string (for example `2026-08`). It is a period identifier, not a timestamp.
- Current application behavior allows draft, issued, paid, and overdue billing records. `overdue` is currently resolved from an issued record's due date at display time; a future backend may materialize it, but must keep that rule consistent.
- Use Firestore document IDs for database identity. Invoice numbers such as `INV-2026-08-001` remain human-readable business identifiers, generated server-side/transactionally when issuance is introduced. They must not be used as Firestore document IDs.

## Snapshot strategy

Bills must remain historically correct after room, tenant, rate, or charge-master changes.

- At bill creation, copy the room number and monthly rent into `roomSnapshot`, and the resolved tenant full name into `tenantSnapshot` when a tenant exists.
- Store the exact electricity and water readings, rates, usage, and amounts in the billing record. Never recompute historical amounts from current room or property settings.
- Copy each selected optional master charge into `otherCharges` as `{ id, masterId?, name, amount }`. `masterId` supports traceability only. Editing, deactivating, or deleting an `OtherChargeMaster` never changes historical charge data.
- The invoice print view must eventually render billing snapshots for historical identity fields, rather than look up a current room or tenant name. This is a future implementation change, not part of this phase.
- `PropertySettings.defaultInvoiceNote` is a creation default. If invoice-note history becomes legally or operationally important, add an `invoiceNoteSnapshot` to `BillingRecord` in the same future migration; the current billing model does not store a note per bill.

## Query patterns and expected indexes

All queries below must include a property scope unless reading an individual document already authorized by the API.

| Use case | Query shape | Composite index expected |
| --- | --- | --- |
| Rooms for property | `propertyId == :propertyId`, ordered by `roomNumber` | `(propertyId ASC, roomNumber ASC)` |
| Occupied/available rooms | `propertyId == :propertyId AND status == :status`, ordered by `roomNumber` | `(propertyId ASC, status ASC, roomNumber ASC)` |
| Tenants for property | `propertyId == :propertyId`, ordered by `lastName`, then `firstName` | `(propertyId ASC, lastName ASC, firstName ASC)` |
| Active assignment for a room | `propertyId == :propertyId AND roomId == :roomId AND status == 'active'` | `(propertyId ASC, roomId ASC, status ASC)` |
| Assignment history for a room | `propertyId == :propertyId AND roomId == :roomId`, ordered by `startDate DESC` | `(propertyId ASC, roomId ASC, startDate DESC)` |
| Active assignment for tenant | `propertyId == :propertyId AND tenantId == :tenantId AND status == 'active'` | `(propertyId ASC, tenantId ASC, status ASC)` |
| Billing for a month | `propertyId == :propertyId AND billingMonth == '2026-08'`, ordered by `roomSnapshot.roomNumber` | `(propertyId ASC, billingMonth ASC, roomSnapshot.roomNumber ASC)` |
| Room billing history | `propertyId == :propertyId AND roomId == :roomId`, ordered by `billingMonth DESC` | `(propertyId ASC, roomId ASC, billingMonth DESC)` |
| Invoice list | `propertyId == :propertyId AND status IN ('issued','paid','overdue')`, ordered by `issuedAt DESC` | `(propertyId ASC, status ASC, issuedAt DESC)` |
| Other charge masters | `propertyId == :propertyId AND isActive == true`, ordered by `nameTh` | `(propertyId ASC, isActive ASC, nameTh ASC)` |

Firestore automatically indexes individual fields. Create these composite indexes only when the Firestore console/emulator confirms the exact query and order; no index configuration is added in this phase. If the UI requires all issued invoices but the final query model cannot express that set cleanly with status filters, use a materialized `isInvoiceIssued` boolean on `BillingRecord` and index `(propertyId, isInvoiceIssued, issuedAt DESC)`; do not infer invoices from an unindexed client-side full collection in production.

## Timestamp, writes, and identity strategy

- Persist `createdAt`, `updatedAt`, `startDate`, `endDate`, `dueDate`, `issuedAt`, and `paidAt` as Firestore `Timestamp` values. Use server timestamps for audit fields and normalize date-only form inputs at the API boundary with a documented property time zone (the current product operates in Thailand).
- Keep `billingMonth` as a validated `YYYY-MM` string. It makes equality filters and month ordering predictable without date-time-zone ambiguity.
- The API/Cloud Functions layer—not the React client—will validate ownership, compute/cross-check totals, allocate invoice numbers, and use transactions for multi-document invariants. No Cloud Functions are implemented in this phase.

## Migration considerations

1. Keep the local repositories and keys unchanged until Firebase integration is explicitly authorized.
2. Create one initial `properties` document from current `PropertySettings.propertyName`, `propertyAddress`, and `phone`; create `propertySettings/{propertyId}` from the remaining default rates and invoice note.
3. Migrate every room, tenant, assignment, other-charge master, and billing record with that initial `propertyId`; preserve existing UUIDs as Firestore document IDs where practical to keep references valid.
4. Convert all current ISO date strings to Firestore `Timestamp` values. Existing assignments lack `updatedAt`; set it to their `createdAt` during migration and record that normalization in the migration log.
5. Build each billing snapshot from the referenced room and tenant at migration time. Where a referenced entity is missing, preserve the bill, set the unavailable foreign key only when necessary, and log it for review rather than silently dropping financial history.
6. Preserve current billing `invoiceNumber`, status, issue/due/payment dates, meter readings, charges, and totals exactly. Do not manufacture a separate invoice document.
7. Create `users/{uid}` profiles only after Firebase Authentication users are established; map the current demo administrator deliberately rather than migrating the browser session as an identity credential.
8. Run migration as an idempotent, auditable administrative job with counts and exception reporting. Only after reconciliation should repository implementations become asynchronous Firestore/API adapters and `localStorage` be retired.

## Non-goals of Phase 1

This Phase 1 design did not include Firebase SDK setup, Firestore configuration, security rules, indexes, Cloud Functions, authentication replacement, repository rewrite, or localStorage removal. The SDK client infrastructure was subsequently added in Phase 2; the remaining items are still future work.
