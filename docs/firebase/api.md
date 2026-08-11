# Backend API: Properties, Settings, Other Charges, Rooms, Tenants, and Assignments

All endpoints use the Functions API base path and require a Firebase ID token unless marked public:

```http
Authorization: Bearer <Firebase ID token>
```

Every response uses `{ "success": true, "data": ... }`; list responses also include `meta.total`. Authentication, profile validation, role checks, and property scope are described in [authentication.md](authentication.md).

**Role policy (uniform across every resource below):** an authenticated `admin` or `staff` user can read any resource in a property they belong to; only `admin` can create, update, delete, or perform a state-changing action (issue, mark-paid, assign, end). No mutation endpoint is reachable without `admin`, and no endpoint is reachable without a valid property membership.

## Properties

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/v1/properties` | Authenticated | Lists only properties in `user.propertyIds`. |
| `GET` | `/api/v1/properties/:id` | Property access | Returns a property, or `403` before revealing an unauthorized property. |
| `POST` | `/api/v1/properties` | Admin | Creates a property and atomically adds its ID to the creator's `propertyIds`. |
| `PATCH` | `/api/v1/properties/:id` | Admin + property access | Updates whitelisted property fields. |

Create body:

```json
{
  "name": "Sunrise Apartments",
  "address": "123 ถนนสุขุมวิท",
  "phone": "02-123-4567"
}
```

`name` is required (1–200 characters); `address` and `phone` are optional strings. IDs and audit timestamps are server-controlled. Property deletion is intentionally not implemented.

## Property settings

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/v1/properties/:propertyId/settings` | Property access | Returns saved settings, or defaults when the settings document does not exist. |
| `PUT` | `/api/v1/properties/:propertyId/settings` | Admin + property access | Creates or replaces the three default billing settings. |

`GET` defaults:

```json
{
  "propertyId": "property-id",
  "defaultElectricityRate": 0,
  "defaultWaterRate": 0,
  "defaultInvoiceNote": ""
}
```

`PUT` body requires all fields:

```json
{
  "defaultElectricityRate": 8,
  "defaultWaterRate": 18,
  "defaultInvoiceNote": "Please pay by the due date."
}
```

Rates must be finite numbers greater than or equal to zero. Settings contain only electricity rate, water rate, and invoice note—never recurring charge defaults.

## Other Charge Master

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/api/v1/properties/:propertyId/other-charges` | Property access |
| `GET` | `/api/v1/properties/:propertyId/other-charges/:id` | Property access |
| `POST` | `/api/v1/properties/:propertyId/other-charges` | Admin + property access |
| `PATCH` | `/api/v1/properties/:propertyId/other-charges/:id` | Admin + property access |
| `DELETE` | `/api/v1/properties/:propertyId/other-charges/:id` | Admin + property access |

List supports the optional exact filter `?isActive=true` or `?isActive=false` and sorts by `nameTh` ascending.

Create body:

```json
{
  "nameTh": "ค่าขยะ",
  "nameEn": "Garbage Fee",
  "defaultAmount": 50,
  "isActive": true
}
```

`nameTh` and non-negative `defaultAmount` are required. `nameEn` is optional; `isActive` defaults to `true`. The API rejects duplicate active Thai names for the same property after whitespace-normalized, case-insensitive comparison (`409 OTHER_CHARGE_ALREADY_EXISTS`).

Deletion is a hard delete of the master only. It does not and will not modify historical bills: future billing records store their own charge snapshots. Other Charge Masters remain optional templates and are never automatically added to monthly bills.

## Errors and Firestore indexes

Validation returns `400 VALIDATION_ERROR`. Missing owned property/charge documents return `404 PROPERTY_NOT_FOUND` or `404 OTHER_CHARGE_NOT_FOUND`; inaccessible property IDs return `403 PROPERTY_ACCESS_DENIED`.

`firestore.indexes.json` contains only the two indexes used by the predictable Other Charge list queries:

- `propertyId, nameTh`
- `propertyId, isActive, nameTh`

## Emulator verification

After starting Functions, Firestore, and Auth Emulator and seeding the development user as described in [authentication.md](authentication.md), run:

```sh
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
GCLOUD_PROJECT=demo-rental-property-management \
DEV_USER_PASSWORD='choose-a-local-password' \
pnpm --dir functions test:resources:emulator
```

The script uses a real Auth Emulator token and verifies property create/update, default settings + settings upsert, Other Charge create/duplicate/update/delete. It creates demo-emulator records only; it is not permitted to run against production.

## Rooms and tenants

All routes below are property scoped; reads require property access and mutations require admin:

| Resource | Endpoints | Filters / ordering |
| --- | --- | --- |
| Rooms | `GET/POST /api/v1/properties/:propertyId/rooms`, `GET/PATCH/DELETE /api/v1/properties/:propertyId/rooms/:id` | Exact `status` (must be a valid room status) and/or `floor`, combinable; string `roomNumber` ascending. |
| Tenants | `GET/POST /api/v1/properties/:propertyId/tenants`, `GET/PATCH/DELETE /api/v1/properties/:propertyId/tenants/:id` | Exact `status`; `fullName` ascending. |

Room number is required, trimmed, and unique only within its property (`409 ROOM_NUMBER_ALREADY_EXISTS`). Rent and provided utility rates must be non-negative; supported room statuses are `available`, `occupied`, `maintenance`, and `inactive`. `occupied` is temporary model compatibility—Step 5 will make assignments authoritative.

Tenant `fullName` is required, text is trimmed, emails are validated when supplied, and status is `active` or `inactive`. Names are not unique and tenants have no direct room field. Rooms and tenants can be hard-deleted only when they have no assignment history: an active assignment returns `409 ROOM_HAS_ACTIVE_ASSIGNMENT` or `409 TENANT_HAS_ACTIVE_ASSIGNMENT`; ended history returns `409 ROOM_HAS_ASSIGNMENT_HISTORY` or `409 TENANT_HAS_ASSIGNMENT_HISTORY`. Set a historically referenced record to `inactive` instead. Assignment history is never cascade-deleted.

## Room assignments

Assignments are the authoritative occupancy history. Every route is property scoped; reads require property access (`admin` or `staff`) and create/end require `admin`.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/properties/:propertyId/assignments` | Lists assignment history, newest `startDate` first. Optional exact filters: `status=active|ended`, `roomId`, and `tenantId`; filters may be combined. |
| `GET` | `/api/v1/properties/:propertyId/assignments/:id` | Gets one assignment. An assignment outside the scoped property is returned as `404 ASSIGNMENT_NOT_FOUND`. |
| `POST` | `/api/v1/properties/:propertyId/assignments` | Creates an active assignment and sets the room to `occupied` atomically. |
| `POST` | `/api/v1/properties/:propertyId/assignments/:id/end` | Ends the active assignment without deleting history. |

Create body:

```json
{
  "roomId": "room-001",
  "tenantId": "tenant-001",
  "startDate": "2026-08-01"
}
```

`propertyId`, status, audit timestamps, and `endDate` are server-controlled. Dates must be real `YYYY-MM-DD` calendar dates and are persisted as Firestore Timestamps at the start of the day in `Asia/Bangkok`.

End body is optional. When omitted, `endDate` defaults to the current Bangkok calendar date:

```json
{
  "endDate": "2026-08-31"
}
```

The end date cannot precede the assignment start date (`400 INVALID_ASSIGNMENT_DATE`). Ending an already ended assignment returns `409 ASSIGNMENT_ALREADY_ENDED`.

### Assignment rules and concurrency

- A room and tenant must both exist in the requested property. A cross-property room/tenant reference is rejected with `400 ASSIGNMENT_PROPERTY_MISMATCH`.
- A room may have one active assignment and an active tenant may have one active assignment. Assignment records, not `room.status`, are checked as the source of truth. Conflicts return `409 ROOM_ALREADY_OCCUPIED` or `409 TENANT_ALREADY_ASSIGNED`.
- Rooms in `maintenance` or `inactive` cannot be assigned (`409 ROOM_NOT_AVAILABLE`); tenants must be `active` (`409 TENANT_NOT_ACTIVE`).
- Create runs in a Firestore transaction: it reads room, tenant, and active assignment queries; creates the assignment; sets the room to `occupied`; and updates the tenant audit timestamp. Touching both room and tenant makes competing requests for either resource conflict and retry, so only one can commit.
- End runs in a Firestore transaction. It changes the assignment to `ended`, stores the end date, and changes the room from `occupied` to `available`. It deliberately leaves a room already set to `maintenance` or `inactive` unchanged. Tenant status is independent and is never made inactive by move-out.
- A future Move API can combine end + create in one transaction. This step intentionally keeps move-out and new assignment as two explicit operations.

The implemented indexes additionally cover `propertyId` with room number/status/floor ordering, including the combined `propertyId + status + floor + roomNumber` index required when both room filters are supplied together, and `propertyId` with tenant full name/status ordering. Assignment indexes cover each supported property-scoped list-filter combination ordered by `startDate DESC`, plus the active room/tenant transaction lookups.

### Emulator verification

After starting the Emulator Suite and seeding the development user as described in [authentication.md](authentication.md), run:

```sh
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
GCLOUD_PROJECT=demo-rental-property-management \
DEV_USER_PASSWORD='choose-a-local-password' \
pnpm --dir functions test:assignments:emulator
```

The verification creates isolated emulator records and checks concurrent creates for one room (exactly one `201`, one `409 ROOM_ALREADY_OCCUPIED`), room occupancy synchronization, active and historical delete protection, end-date validation, ending, repeated end conflicts, and maintenance/inactive eligibility. It must not run against production.

## Billing

All Billing routes are property scoped. `admin` and `staff` can read; only `admin` can create, edit, or delete.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/properties/:propertyId/billing` | Lists records by `billingMonth DESC`, then `createdAt DESC`. Exact `billingMonth`, `roomId`, `tenantId`, and `status` filters can be combined. |
| `GET` | `/api/v1/properties/:propertyId/billing/:id` | Returns one owned record. |
| `POST` | `/api/v1/properties/:propertyId/billing` | Creates one draft monthly bill for a room. |
| `PATCH` | `/api/v1/properties/:propertyId/billing/:id` | Recalculates an existing draft. Room and billing month are immutable. |
| `DELETE` | `/api/v1/properties/:propertyId/billing/:id` | Deletes a draft only. |

Create body:

```json
{
  "roomId": "room-001",
  "billingMonth": "2026-08",
  "electricity": { "previousMeter": 1200, "currentMeter": 1250 },
  "water": { "previousMeter": 300, "currentMeter": 310 },
  "otherCharges": [{ "masterId": "charge-001", "amount": 80 }],
  "customCharges": [{ "name": "ค่าซ่อมกุญแจ", "amount": 150 }],
  "dueDate": "2026-09-15"
}
```

`rentAmount` is an optional non-negative per-bill override; otherwise the room's current `monthlyRent` is used. Client-supplied usage, utility amounts/rates, snapshots, totals, status, and audit fields are ignored. The API resolves rates from the room first, then property settings; resolves the active assigned tenant when available; copies room/tenant, rate, charge, and invoice-note snapshots; and sets status to `draft`.

The server calculates usage as `currentMeter - previousMeter` (kept as an exact, unrounded quantity) and rejects a decreasing meter reading. Only money is rounded, to two decimal places, at each point a monetary value is produced: `amount = round(usage * rate)`, `subtotal = round(rent + electricity.amount + water.amount)`, `total = round(subtotal + otherChargesTotal)` — see [ADR 0001](../adr/0001-billing-rounding-rule.md). The default due date is the 15th of the following month in the product calendar. A room without an active tenant is billable, with `tenantId` and `tenantSnapshot` set to `null`.

One billing record per `(propertyId, roomId, billingMonth)` is enforced by a deterministic `billingRecords` document ID (`` `${roomId}_${billingMonth}` ``), not just the pre-create existence query: two concurrent creates for the same room+month contend on that one document, so exactly one commits and the other retries into `409 BILLING_ALREADY_EXISTS` — see [ADR 0004](../adr/0004-billing-record-deterministic-id.md). Other Charge Masters are copied into the bill and may be overridden without changing the master; duplicate master IDs are rejected. Draft edits preserve all identity snapshots and existing rate snapshots, while recalculating from permitted edited inputs. Issued, paid, and overdue records are neither editable (`409 BILLING_NOT_EDITABLE`) nor deletable (`409 BILLING_NOT_DELETABLE`).

## Invoices

All routes are property scoped. Authenticated `admin` and `staff` users can read; only `admin` can create an invoice or mark it paid.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/properties/:propertyId/invoices` | Lists invoices by `issuedAt DESC`; `billingMonth`, `roomId`, `tenantId`, and `status` filters can be combined. |
| `GET` | `/api/v1/properties/:propertyId/invoices/:id` | Returns a complete immutable invoice snapshot. |
| `POST` | `/api/v1/properties/:propertyId/invoices` | Issues one invoice from a draft billing record. |
| `POST` | `/api/v1/properties/:propertyId/invoices/:id/mark-paid` | Marks Invoice and its BillingRecord paid in one transaction. |

Create body is only `{ "billingId": "billing-001" }`. Billing is the exclusive source for room/tenant snapshots, ordered item lines (rent, electricity, water, then selected other charges), totals, due date, and note. No client invoice number, amount, item, snapshot, or status is accepted.

Issuance uses one Firestore transaction to ensure the bill belongs to the property and is `draft`, prevent an existing Invoice for the bill, increment `counters/invoice-{propertyId}-{YYYY-MM}`, create the Invoice, and set the BillingRecord to `issued` with `invoiceId`, `invoiceNumber`, and `issuedAt`. The number is immutable and property/month scoped: `INV-YYYY-MM-NNN`, reset for every month. Duplicate or concurrent attempts yield one successful invoice and `409 INVOICE_ALREADY_EXISTS` or `409 BILLING_ALREADY_ISSUED` for the other attempt.

Invoices have persisted `issued` and `paid` states. `overdue` is derived at read time when an issued invoice has a past due date; no scheduled job writes it. Mark-paid rejects an already paid invoice (`409 INVOICE_ALREADY_PAID`) and accepts an optional valid ISO `paidAt` no earlier than the invoice's `issuedAt` (`400 INVALID_PAYMENT_DATE` otherwise), so a real (possibly backdated) payment date can be recorded; without it, server time is used — see [ADR 0002](../adr/0002-invoice-paid-at-client-suppliable.md). Invoice hard deletion and generic invoice updates are intentionally unsupported.
