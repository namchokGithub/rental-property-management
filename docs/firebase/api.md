# Backend API: Properties, Settings, and Other Charges

All endpoints use the Functions API base path and require a Firebase ID token unless marked public:

```http
Authorization: Bearer <Firebase ID token>
```

Every response uses `{ "success": true, "data": ... }`; list responses also include `meta.total`. Authentication, profile validation, role checks, and property scope are described in [authentication.md](authentication.md).

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
| Rooms | `GET/POST /api/v1/properties/:propertyId/rooms`, `GET/PATCH/DELETE /api/v1/properties/:propertyId/rooms/:id` | Exact `status`, `floor`; string `roomNumber` ascending. |
| Tenants | `GET/POST /api/v1/properties/:propertyId/tenants`, `GET/PATCH/DELETE /api/v1/properties/:propertyId/tenants/:id` | Exact `status`; `fullName` ascending. |

Room number is required, trimmed, and unique only within its property (`409 ROOM_NUMBER_ALREADY_EXISTS`). Rent and provided utility rates must be non-negative; supported room statuses are `available`, `occupied`, `maintenance`, and `inactive`. `occupied` is temporary model compatibility—Step 5 will make assignments authoritative.

Tenant `fullName` is required, text is trimmed, emails are validated when supplied, and status is `active` or `inactive`. Names are not unique and tenants have no direct room field. Step 5 will introduce Room ↔ Tenant assignments and deletion restrictions; both resources currently hard-delete.

The implemented indexes additionally cover `propertyId` with room number/status/floor ordering and `propertyId` with tenant full name/status ordering.
