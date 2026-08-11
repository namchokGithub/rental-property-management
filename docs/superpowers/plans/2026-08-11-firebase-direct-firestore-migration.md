# Firebase Direct-to-Firestore Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Deviation from the standard writing-plans template, by design:** this plan does not use red/green TDD micro-steps. The project has zero test runner/framework today (no `vitest`/`jest`, no `test` script in `package.json`) and the user's own spec defines the verification gate explicitly as "run typecheck, lint, and production build after each phase" — not automated tests. Introducing a test framework is out of scope unless requested separately. Each phase instead ends with `pnpm build` (which runs `tsc -b` then `vite build`), `pnpm lint`, and a manual smoke test against the Firebase Emulator Suite.

**Goal:** Remove the Cloud Functions backend and REST API client entirely; make the React frontend talk to Firebase Authentication and Firestore directly, with Firestore Security Rules as the sole authorization boundary, deployed as a static site to GitHub Pages.

**Architecture:** `AuthContext` subscribes to `onAuthStateChanged()` and loads the user's profile from `users/{uid}` in Firestore (no backend call). Every business repository (`rooms`, `tenants`, `assignments`, `billing`, `otherCharges`, `settings`) moves from synchronous `localStorage` CRUD to async Firestore CRUD scoped under `properties/{propertyId}/...` subcollections, using `onSnapshot()` for live reads and `runTransaction()` for the three write paths that require multi-document atomicity (assignment create/end, room-status coordination, invoice-number issuance). Firestore Security Rules enforce that a user may only read/write documents under a `propertyId` present in their own `users/{uid}.propertyIds` array, with `role: "admin"` required for every write and `role: "staff"` limited to reads — this is the only authorization check that can be trusted, since there is no server.

**Tech Stack:** Vite 8 + React 19 + TypeScript ~6 (strict), `firebase` JS SDK v12 (already installed) — modular `firebase/auth` + `firebase/firestore`, no `firebase-admin`, no Cloud Functions, no REST layer.

## Global Constraints

- No backend, no Cloud Functions, no server proxy of any kind. The deployed artifact is static files on GitHub Pages (`vite.config.ts` already sets `base: "/rental-property-management/"` for `vite build` — unchanged by this plan).
- No migration path from `localStorage` or from the existing REST API is needed — there is no real data yet. Delete legacy code outright; do not build compatibility shims.
- Preserve existing UI, routes, TypeScript domain types (`src/types/*.ts`), and documented business rules (`context.md`) as closely as possible. Only add fields/behavior where Firestore's transactional model strictly requires it (called out explicitly below wherever it happens).
- TypeScript strict mode stays on; no `any`.
- `localStorage` access for **UI preferences only** (`app.language`, `app.appearance`, `app.accentTheme`) is unaffected by this plan and must keep working exactly as today.
- After every phase: `pnpm build` (typecheck + production build) and `pnpm lint` must both pass with zero errors, plus a manual smoke test against `firebase emulators:start` (Auth + Firestore emulators) covering that phase's feature end-to-end in the browser.
- `firebase.json`/`firestore.rules`/`firestore.indexes.json` already exist at the repo root (added in the now-being-removed backend phase) and are reused/rewritten, not recreated from scratch.

---

## Decisions requiring your confirmation before Phase 1 starts

The spec names five collections explicitly. Building them correctly requires a few calls the spec doesn't make explicitly. Recommended defaults are marked; flag any you want changed before I touch code.

**Decision A — Drop the separate `invoices`/`counters` collections; revert to "Invoices is a filtered view over billing."**
The already-built (soon-to-be-deleted) Cloud Functions backend introduced an immutable `invoices` collection plus a `counters/invoice-{propertyId}-{month}` document for server-side sequencing. That richer model doesn't fit here for three reasons: it isn't in your five-collection list, the original pre-backend frontend design (documented in `context.md`'s Domain Model section) deliberately avoided a separate Invoice entity ("two sources of truth" concern), and a real backend is the only thing that made the immutability guarantee meaningful — a client transaction can't enforce immutability any better than it enforces anything else.
**Recommendation: revert to the original model.** `properties/{propertyId}/billing` stays the single source of truth; a record becomes "issued" via a transaction that assigns `invoiceNumber` by scanning existing billing docs for that property+month (same logic as today's `generateInvoiceNumber()` in `src/lib/invoice.ts`, just done inside a Firestore transaction instead of a synchronous array scan). The Invoices page keeps filtering `billing` records that have `invoiceNumber` set, exactly as today.

**Decision B — Other Charge Masters: embed in `settings/general`, not a separate subcollection.**
`OtherChargeMaster` records are a small reusable list (garbage fee, parking, etc.) — realistically a handful to a few dozen rows, edited rarely, only from the Settings page. Your spec's five paths don't include an other-charges collection.
**Recommendation:** store them as an array field `otherChargeMasters: OtherChargeMaster[]` inside the single `properties/{propertyId}/settings/general` document rather than adding a sixth subcollection. This keeps your literal collection list intact, needs no extra security-rule block, and `onSnapshot` on one document gives live updates for the whole list for free. Firestore's 1&nbsp;MiB document limit is not a realistic concern for this data. If you'd rather have `properties/{propertyId}/otherCharges/{chargeId}` as its own subcollection (more conventional, slightly more code), say so and Phase 2 will use that shape instead.

**Decision C — Bootstrapping the first admin user without a backend.**
There's no sign-up flow and no Cloud Functions left to safely create `users/{uid}` documents (rules must forbid users from writing their own profile/role — otherwise anyone could grant themselves `admin`). The very first property + admin profile has to be created by hand.
**Recommendation:** a documented manual one-time setup (Firebase Console): create the Auth user under Authentication, then manually create `properties/{propertyId}`, `properties/{propertyId}/settings/general`, and `users/{uid}` (`role: "admin"`, `propertyIds: [propertyId]`, `isActive: true`) under Firestore. This is written up as a "First-Time Setup" section in the README (Phase 6) — no script, no `firebase-admin` dependency, nothing that resembles a backend. If you'd rather have a local Node seed script (using the Firebase Admin SDK, run manually by a developer, never deployed), say so — it's a bit more convenient for repeated local emulator resets but is an extra dependency.

**Decision D — Hooks gain an `isLoading` flag; components get a minimal loading state.**
Every hook today (`useRooms`, `useTenants`, etc.) is 100% synchronous, seeded from a synchronous `localStorage` read. Firestore's `onSnapshot()` is inherently async — the first snapshot arrives after a round trip even against the emulator. Defaulting to an empty array during that gap would make every page flash its "no records yet — create one" empty state before real data arrives, which is worse than a spinner.
**Recommendation:** each hook adds a `isLoading: boolean` (`true` until the first snapshot fires), additive to the existing return shape — no existing property renamed or removed. Pages add one `if (isLoading) return <PageSpinner />` line before their existing (unchanged) render logic. This is the only UI-shape change in the whole plan beyond what's structurally forced by going async.

If you'd rather I stop and get sign-off on these four before writing any code, say so — otherwise, approving the overall plan is taken as approving these defaults too, and any you want changed can be corrected in place during that phase's review.

---

## Firestore Schema

```
users/{uid}                                    — profile + authorization (top-level, keyed by Auth UID)
properties/{propertyId}                        — property identity (name, address, phone)
properties/{propertyId}/settings/general       — single doc: billing defaults + other-charge masters (Decision B)
properties/{propertyId}/rooms/{roomId}
properties/{propertyId}/tenants/{tenantId}
properties/{propertyId}/assignments/{assignmentId}
properties/{propertyId}/billing/{billingId}    — deterministic ID `${roomId}_${billingMonth}` (unchanged pattern from the current backend's ADR 0004)
```

No `invoices` or `counters` collection (Decision A). No `propertyId` field duplicated inside subcollection documents — the collection path already scopes it, so there is exactly one source of truth for which property a document belongs to.

### `users/{uid}`

| Field                    | Type                 | Notes                                                                                         |
| ------------------------ | -------------------- | --------------------------------------------------------------------------------------------- |
| `name`                   | `string`             |                                                                                               |
| `email`                  | `string`             | Mirrors the Firebase Auth email; Firestore is still the profile source of truth per the spec. |
| `role`                   | `"admin" \| "staff"` |                                                                                               |
| `propertyIds`            | `string[]`           | Properties this user may access.                                                              |
| `isActive`               | `boolean`            | `false` disables access without deleting the Auth account.                                    |
| `createdAt`, `updatedAt` | `Timestamp`          |                                                                                               |

Document ID = Firebase Auth UID. Written only by hand (Decision C) — no client write path exists for this collection at all.

### `properties/{propertyId}`

| Field                    | Type        | Notes                               |
| ------------------------ | ----------- | ----------------------------------- |
| `name`                   | `string`    | Was`PropertySettings.propertyName`. |
| `address`                | `string?`   |                                     |
| `phone`                  | `string?`   |                                     |
| `createdAt`, `updatedAt` | `Timestamp` |                                     |

### `properties/{propertyId}/settings/general`

| Field                    | Type                  | Notes                                                                                                                                                                                                                                            |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `defaultElectricityRate` | `number`              |                                                                                                                                                                                                                                                  |
| `defaultWaterRate`       | `number`              |                                                                                                                                                                                                                                                  |
| `defaultInvoiceNote`     | `string`              |                                                                                                                                                                                                                                                  |
| `otherChargeMasters`     | `OtherChargeMaster[]` | Embedded array (Decision B). Each item:`{ id, nameTh, nameEn?, defaultAmount, isActive, createdAt, updatedAt }` — `createdAt`/`updatedAt` stay ISO strings here (not `Timestamp`) since they're inside an array, not a queryable document field. |
| `createdAt`, `updatedAt` | `Timestamp`           |                                                                                                                                                                                                                                                  |

### `properties/{propertyId}/rooms/{roomId}`

| Field                    | Type                                                       | Notes                                                                                       |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `roomNumber`             | `string`                                                   | Unique within the property (enforced client-side at write time; see Phase 3 note on races). |
| `floor`                  | `string?`                                                  |                                                                                             |
| `type`                   | `string?`                                                  |                                                                                             |
| `monthlyRent`            | `number`                                                   |                                                                                             |
| `status`                 | `"available" \| "occupied" \| "maintenance" \| "inactive"` |                                                                                             |
| `description`            | `string?`                                                  |                                                                                             |
| `electricityRate`        | `number`                                                   |                                                                                             |
| `waterRate`              | `number`                                                   |                                                                                             |
| `createdAt`, `updatedAt` | `Timestamp`                                                |                                                                                             |

### `properties/{propertyId}/tenants/{tenantId}`

| Field                                                                                                         | Type                     | Notes                                                       |
| ------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `name`                                                                                                        | `string`                 | Fixes the pre-existing`fullName`/`.name` bug — see Phase 0. |
| `phone`, `email`, `identificationNumber`, `address`, `emergencyContactName`, `emergencyContactPhone`, `notes` | `string?`                |                                                             |
| `status`                                                                                                      | `"active" \| "inactive"` |                                                             |
| `createdAt`, `updatedAt`                                                                                      | `Timestamp`              |                                                             |

### `properties/{propertyId}/assignments/{assignmentId}`

| Field       | Type                  | Notes                                                                                                                                                                                                                                                                                                                                       |
| ----------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roomId`    | `string`              |                                                                                                                                                                                                                                                                                                                                             |
| `tenantId`  | `string`              |                                                                                                                                                                                                                                                                                                                                             |
| `startDate` | `Timestamp`           |                                                                                                                                                                                                                                                                                                                                             |
| `endDate`   | `Timestamp \| null`   |                                                                                                                                                                                                                                                                                                                                             |
| `status`    | `"active" \| "ended"` |                                                                                                                                                                                                                                                                                                                                             |
| `createdAt` | `Timestamp`           |                                                                                                                                                                                                                                                                                                                                             |
| `updatedAt` | `Timestamp`           | **New field**, absent from today's `RoomTenantAssignment` type. Needed so the assign/end transactions can "touch" this document the same way they touch the room/tenant docs, forcing Firestore's optimistic-concurrency check to serialize two simultaneous assignment attempts for the same tenant (see Phase 4). Additive, non-breaking. |

### `properties/{propertyId}/billing/{roomId_billingMonth}`

| Field                           | Type                                                   | Notes                                                                                              |
| ------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `roomId`                        | `string`                                               |                                                                                                    |
| `tenantId`                      | `string \| null`                                       |                                                                                                    |
| `invoiceNumber`                 | `string \| null`                                       | Set only at issuance.                                                                              |
| `billingMonth`                  | `string`                                               | `"YYYY-MM"`.                                                                                       |
| `electricity`, `water`          | `{ previousMeter, currentMeter, usage, rate, amount }` |                                                                                                    |
| `rentAmount`                    | `number`                                               |                                                                                                    |
| `otherCharges`                  | `{ id, masterId?, name, amount }[]`                    |                                                                                                    |
| `subtotal`, `total`             | `number`                                               |                                                                                                    |
| `status`                        | `"draft" \| "issued" \| "paid" \| "overdue"`           | `"overdue"` is still display-only, resolved at read time — never persisted (unchanged from today). |
| `issuedAt`, `dueDate`, `paidAt` | `Timestamp \| null`                                    |                                                                                                    |
| `createdAt`, `updatedAt`        | `Timestamp`                                            |                                                                                                    |

Document ID stays `${roomId}_${billingMonth}` — this is what makes "at most one bill per room per month" a Firestore-enforced invariant (a second `create` on the same ID fails/contends) rather than something only the UI checks, exactly matching the existing backend's ADR 0004 reasoning, just ported to a client transaction instead of an Admin SDK one.

---

## Firestore Security Rules (`firestore.rules`)

Replaces the current fully-closed (`allow read, write: if false`) ruleset — that ruleset made sense only because a trusted backend (Admin SDK bypasses rules) handled everything; with no backend, these rules are the _entire_ authorization system.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function userProfile() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isActiveUser() {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && userProfile().isActive == true;
    }

    function hasPropertyAccess(propertyId) {
      return isActiveUser() && propertyId in userProfile().propertyIds;
    }

    function isAdminForProperty(propertyId) {
      return hasPropertyAccess(propertyId) && userProfile().role == 'admin';
    }

    // ---- Profiles: never client-writable. Created/edited by hand (Decision C). ----
    match /users/{uid} {
      allow get: if isSignedIn() && request.auth.uid == uid;
      allow list, write: if false;
    }

    // ---- Property-scoped business data ----
    match /properties/{propertyId} {
      allow read: if hasPropertyAccess(propertyId);
      allow write: if isAdminForProperty(propertyId);

      match /settings/{settingsDoc} {
        allow read: if hasPropertyAccess(propertyId);
        allow write: if isAdminForProperty(propertyId);
      }

      match /rooms/{roomId} {
        allow read: if hasPropertyAccess(propertyId);
        allow write: if isAdminForProperty(propertyId);
      }

      match /tenants/{tenantId} {
        allow read: if hasPropertyAccess(propertyId);
        allow write: if isAdminForProperty(propertyId);
      }

      match /assignments/{assignmentId} {
        allow read: if hasPropertyAccess(propertyId);
        allow write: if isAdminForProperty(propertyId);
      }

      match /billing/{billingId} {
        allow read: if hasPropertyAccess(propertyId);
        // Once a bill is issued, invoiceNumber/issuedAt must never change again —
        // the closest a client-only rule can get to the immutability the old
        // backend's `invoices` collection gave for free.
        allow create, delete: if isAdminForProperty(propertyId);
        allow update: if isAdminForProperty(propertyId)
          && (resource.data.invoiceNumber == null
              || (request.resource.data.invoiceNumber == resource.data.invoiceNumber
                  && request.resource.data.issuedAt == resource.data.issuedAt));
      }
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Notes for the implementer:

- `get()`/`exists()` calls against `users/{uid}` are repeated across several functions; Firestore rules dedupe identical `get()`s within one rule evaluation, so this doesn't multiply read costs per document touched in a single request the way it looks like it would.
- `staff` gets `hasPropertyAccess` (read) everywhere and nothing from `isAdminForProperty` — matches the existing backend's "any authenticated member reads, only admin writes" policy exactly (see `context.md`'s Backend architecture summary), just re-homed from Express middleware into rules.
- This cannot fully replicate what the transactional backend guaranteed (e.g., "at most one active assignment per room" is enforced by the client transaction's read-before-write logic, not by a rule — a rule can't easily inspect sibling documents in the same collection cheaply). That gap is real and is called out again in Risks/Limitations below; it's an accepted consequence of removing the backend, not an oversight.

---

## Firestore Indexes (`firestore.indexes.json`)

Because every list page already loads its **entire** collection into memory and filters/searches client-side (confirmed in the audit — `BillingPage`, `RoomsPage`, etc. never issue a server-side filtered query today), most subcollection reads in this migration are unfiltered `onSnapshot(collection(...))` calls and need no composite index at all. The only exceptions are the two transactional consistency checks that must run _inside_ a Firestore transaction (they can't just scan a locally-cached array, since the whole point is to check against the server's current state):

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
  ],
  "fieldOverrides": []
}
```

(Two equality filters on different fields with no `orderBy` are actually served by Firestore's automatic per-field indexes without a composite index in most cases — these two are listed explicitly anyway because they run inside `runTransaction()` where a missing-index error surfaces as a transaction abort with a less obvious message; declaring them up front avoids a confusing first-run failure.) If Phase 6's manual smoke testing surfaces a `FAILED_PRECONDITION: The query requires an index` error anywhere else, add the exact index Firestore's error message links to — don't pre-guess further ones.

---

## File Inventory

### Delete entirely

- `functions/` (whole directory — Express app, routes, controllers, services, repositories, middleware, validators, error codes, scripts, its own `package.json`/`node_modules`)
- `src/api/client.ts`, `src/api/errors.ts` (and the now-empty `src/api/` directory)
- `src/lib/firebase/functions.ts`
- `docs/firebase/backend.md`, `docs/firebase/api.md`, `docs/firebase/authentication.md` (Cloud-Functions-specific; superseded by this plan)
- `docs/adr/0003-cors-fail-closed-outside-emulator.md` (no server, no CORS, decision no longer applies)
- `firebase.json`'s `"functions"` key and the `"emulators.functions"` block (keep `firestore` + `auth` emulator config)

### Rewrite

- `docs/firebase/data-model.md` — replace the top-level-collections model with this plan's subcollection model
- `docs/firebase/setup.md` — remove Functions-region env var and Functions-client instructions
- `README.md` — remove the demo-auth section and the "Firebase Backend (Cloud Functions)" section; add "First-Time Setup" (Decision C) and an updated Authentication section
- `.env.example` — remove `VITE_API_BASE_URL`, remove `VITE_FIREBASE_FUNCTIONS_REGION`
- `context.md` — update Authentication, Firebase Migration, Storage Keys, and Domain Model sections once each phase lands (ongoing, not a single pass)

### Modify (by phase — see below for exact responsibilities)

`src/types/tenant.ts`, `src/types/firestore/*.ts` (repurposed as the actual Firestore document types, replacing the local/Firestore type split), `src/auth/auth.types.ts`, `src/auth/auth.service.ts`, `src/auth/AuthContext.tsx`, `src/lib/firebase/config.ts`, `src/lib/firebase/emulators.ts`, `src/lib/firebase/index.ts`, every file under `src/data/repositories/*`, every file under `src/hooks/use*.ts`, `src/lib/invoice.ts`, `src/data/seed/seedData.ts` (deleted — see Phase 1), `src/data/migrations/*` (deleted — see Phase 1), `src/data/storage/storage.ts` (kept, but only for the three UI-preference keys), feature pages that need a loading branch or role-gated actions (`src/features/rooms/RoomsPage.tsx`, `src/features/tenants/TenantsPage.tsx`, `src/features/billing/BillingPage.tsx`, `src/features/invoices/InvoicesPage.tsx`, `src/features/settings/SettingsPage.tsx`, `src/components/layout/AppSidebar.tsx` if nav gating is added).

### New files

- `src/lib/firebase/firestore.ts` already exists (Phase 2 of the prior migration) and is reused as-is.
- `src/data/repositories/firestoreCrud.ts` — the generic single-collection CRUD factory (Phase 2).
- `src/data/repositories/converters/*.ts` — one Firestore `DataConverter` per collection, translating `Timestamp` ⇄ ISO string so the rest of the app keeps working with the existing string-based domain types (Phase 2 onward).

---

## Task 0: Fix the pre-existing `Tenant.fullName`/`.name` build break

**Goal:** `pnpm build` succeeds on this branch before any Firebase-specific work starts. This is unrelated to Firebase but blocks verifying every later phase.

**Files:**

- Modify: `src/types/tenant.ts`

**Steps:**

- [ ] **Step 1: Rename the field**

In `src/types/tenant.ts`, change:

```ts
export interface Tenant {
  id: string;
  fullName: string;
  // ...
}
```

to:

```ts
export interface Tenant {
  id: string;
  name: string;
  // ...
}
```

Do the same in `CreateTenantInput`/`UpdateTenantInput` if `fullName` appears there too.

- [ ] **Step 2: Verify the fix**

Run: `pnpm build`
Expected: the 26 `fullName`/`name` TypeScript errors are gone. Any _remaining_ errors are unrelated pre-existing issues — stop and report them rather than papering over them.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new warnings introduced by this rename.

- [ ] **Step 4: Commit**

```bash
git add src/types/tenant.ts
git commit -m "fix: rename Tenant.fullName to name to match all consumers"
```

---

## Task 1: Remove the Cloud Functions backend, the REST API client, and rewire Auth to Firestore directly

**Goal:** The app authenticates and loads the user's profile using only `firebase/auth` + `firebase/firestore` — no `functions/`, no `src/api/`, no `VITE_API_BASE_URL` anywhere. Login/logout/session-restore behavior is otherwise unchanged from the user's point of view.

**Files:**

- Delete: `functions/` (entire tree), `src/api/client.ts`, `src/api/errors.ts`, `src/lib/firebase/functions.ts`
- Modify: `src/auth/auth.types.ts`, `src/auth/auth.service.ts`, `src/auth/AuthContext.tsx`, `src/lib/firebase/config.ts`, `src/lib/firebase/emulators.ts`, `src/lib/firebase/index.ts`, `.env.example`, `firebase.json`
- Create: `firestore.rules` (the ruleset above — `users/{uid}` block only is strictly needed to make login work; the rest of the ruleset can land in the same commit since it's all one file), `firestore.indexes.json` (from above)

**Interfaces:**

- Produces: `fetchUserProfile(uid: string): Promise<AuthUser | null>` in `src/auth/auth.service.ts`, replacing `fetchCurrentUserProfile()`. `AuthUser` gains no new fields (`{ id, name, email, role, propertyIds }` unchanged).
- Consumes (from Phase 0): `Tenant.name` — unrelated to auth, no interaction.

- [x] **Step 1: Delete the backend and API client**

```bash
git rm -r functions/
git rm -r src/api/
git rm src/lib/firebase/functions.ts
```

- [x] **Step 2: Strip the Functions client wiring**

In `src/lib/firebase/config.ts`, remove `getFirebaseFunctionsRegion()` and the `VITE_FIREBASE_FUNCTIONS_REGION` read. In `src/lib/firebase/emulators.ts`, remove the Functions-emulator `connectFunctionsEmulator(...)` call and its import. In `src/lib/firebase/index.ts`, remove the `functions` export from the barrel.

- [x] **Step 3: Rewrite `src/auth/auth.service.ts`**

```ts
import {
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { AuthProvider, AuthUser } from "@/auth/auth.types";
import { InvalidCredentialsError } from "@/auth/auth.types";

const INVALID_CREDENTIAL_CODES = new Set([
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-email",
]);

interface UserProfileDoc {
  name: string;
  email: string;
  role: "admin" | "staff";
  propertyIds: string[];
  isActive: boolean;
}

export async function fetchUserProfile(uid: string): Promise<AuthUser | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as UserProfileDoc;
  if (!data.isActive) return null;
  return {
    id: uid,
    name: data.name,
    email: data.email,
    role: data.role,
    propertyIds: data.propertyIds,
  };
}

class FirebaseAuthService implements AuthProvider {
  async login(email: string, password: string): Promise<AuthUser> {
    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        INVALID_CREDENTIAL_CODES.has((error as { code: string }).code)
      ) {
        throw new InvalidCredentialsError();
      }
      throw error;
    }
    const profile = await fetchUserProfile(credential.user.uid);
    if (!profile) {
      await signOut(auth);
      throw new InvalidCredentialsError();
    }
    return profile;
  }

  async logout(): Promise<void> {
    await signOut(auth);
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const current: FirebaseUser | null = auth.currentUser;
    if (!current) return null;
    return fetchUserProfile(current.uid);
  }
}

export const authService: AuthProvider = new FirebaseAuthService();
```

Note what's gone versus today's version: no `ApiError`, no `unauthorized`/`forbidden` distinction (that was HTTP-status-driven; a missing/inactive Firestore profile is now just "no profile," handled the same way `getDoc` returning `exists() === false` is handled everywhere else in Firestore code).

- [x] **Step 4: Rewrite `src/auth/AuthContext.tsx`**

Keep the same public shape (`{ user, isAuthenticated, isLoading, login, logout }`) and the same `loadedUidRef` de-duplication idea, but call `fetchUserProfile` instead of `fetchCurrentUserProfile`, and drop the 401-signs-out-403-doesn't distinction (there's no HTTP status anymore — a `null` profile from Firestore just means "not authorized," which already leaves `user` as `null` and shows `LoginPage`, matching the old 403 behavior; there's no separate "token rejected" case to distinguish since `onAuthStateChanged` firing with a Firebase user already means the token is valid).

```tsx
import { onAuthStateChanged } from "firebase/auth";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { authService, fetchUserProfile } from "@/auth/auth.service";
import type { AuthUser } from "@/auth/auth.types";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadedUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        loadedUidRef.current = null;
        setUser(null);
        setIsLoading(false);
        return;
      }
      if (loadedUidRef.current === firebaseUser.uid) {
        setIsLoading(false);
        return;
      }
      const profile = await fetchUserProfile(firebaseUser.uid);
      loadedUidRef.current = firebaseUser.uid;
      setUser(profile);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  async function login(email: string, password: string) {
    const profile = await authService.login(email, password);
    loadedUidRef.current = profile.id;
    setUser(profile);
  }

  function logout() {
    setUser(null);
    loadedUidRef.current = null;
    void authService.logout();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
```

- [x] **Step 5: Update `.env.example`**

Remove the `VITE_API_BASE_URL` block and the `VITE_FIREBASE_FUNCTIONS_REGION` line entirely. The remaining file should only have the six `VITE_FIREBASE_*` web-app config vars plus `VITE_USE_FIREBASE_EMULATOR`.

- [x] **Step 6: Update `firebase.json`**

Remove the `"functions"` array and the `"emulators": { "functions": { ... } }` entry; keep `"firestore"` and `"emulators": { "auth": ..., "firestore": ..., "ui": ... }`.

- [ ] **Step 7: Write `firestore.rules` and `firestore.indexes.json`**

Use the full ruleset and index list from the Security Rules / Indexes sections above (the property-scoped blocks are dead code until Phase 2+ populates those collections, but there's no reason to ship them in a separate phase — the file is small and reviewable as one unit).

- [ ] **Step 8: Manual smoke test**

Run: `firebase emulators:start --only auth,firestore` in one terminal, `pnpm dev` in another.
In the Firestore Emulator UI (`http://127.0.0.1:4001`), manually create `users/<uid>` for a user you create in the Auth Emulator UI (`role: "admin"`, `propertyIds: ["demo-property"]`, `isActive: true`, `name`, `email`). Log in through the app. Expected: successful login, `useAuth().user` populated, logout works, refresh preserves the session.

- [ ] **Step 9: Verify and commit**

Run: `pnpm build && pnpm lint`
Expected: zero errors.

```bash
git add -A
git commit -m "refactor: remove Cloud Functions backend and REST API client; auth reads Firestore users/{uid} directly"
```

---

## Task 2: Firestore repository foundation + Settings/Other-Charge-Masters migration

**Goal:** Establish the reusable Firestore repository pattern (converters, generic CRUD factory, transaction helpers) using the smallest, lowest-risk resource as the proving ground: `propertySettings` + embedded `otherChargeMasters` (Decision B). `useSettings`/`useOtherCharges` become async with `onSnapshot`.

**Files:**

- Create: `src/data/repositories/converters/timestamp.ts` (shared Timestamp⇄ISO helpers), `src/data/repositories/settingsRepository.ts` (rewritten), `src/data/repositories/otherChargeRepository.ts` (rewritten to operate on the embedded array)
- Modify: `src/hooks/useSettings.ts`, `src/hooks/useOtherCharges.ts`, `src/features/settings/SettingsPage.tsx` (add `isLoading` branch)
- Delete: `src/data/migrations/legacyChargeMigration.ts` (no data to migrate — spec explicitly waives migration), `src/data/seed/seedData.ts` and its call site in `src/main.tsx` (no demo seeding against a shared Firestore project; the manual bootstrap in Decision C replaces it)

**Interfaces:**

- Consumes: `db` from `src/lib/firebase` (Phase 1), current property ID — see note below on where `propertyId` comes from.
- Produces: `settingsRepository.get(propertyId): Promise<PropertySettings>`, `settingsRepository.update(propertyId, input): Promise<PropertySettings>`, `settingsRepository.subscribe(propertyId, cb): Unsubscribe`; `otherChargeRepository.{create,update,delete,getActive}` operating on the same document's array field.

**Note on `propertyId` sourcing:** the UI is single-property today (confirmed in the audit — no property switcher exists). Add one module, `src/lib/activeProperty.ts`, exporting `getActivePropertyId(): string` that reads `user.propertyIds[0]` from `useAuth()` — every repository call in every phase takes this as an explicit parameter (never re-derives it internally), so a future multi-property switcher only has to change call sites, not repository internals.

- [ ] **Step 1: Timestamp converter helpers**

```ts
// src/data/repositories/converters/timestamp.ts
import { Timestamp } from "firebase/firestore";

export function timestampToIso(
  value: Timestamp | null | undefined,
): string | undefined {
  return value ? value.toDate().toISOString() : undefined;
}

export function isoToTimestamp(
  value: string | null | undefined,
): Timestamp | null {
  return value ? Timestamp.fromDate(new Date(value)) : null;
}
```

- [ ] **Step 2: Rewrite `settingsRepository.ts`**

```ts
// src/data/repositories/settingsRepository.ts
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PropertySettings } from "@/types/settings";

const DEFAULTS: PropertySettings = {
  propertyName: "",
  propertyAddress: "",
  phone: "",
  defaultElectricityRate: 0,
  defaultWaterRate: 0,
  defaultInvoiceNote: "",
};

function settingsRef(propertyId: string) {
  return doc(db, "properties", propertyId, "settings", "general");
}

export const settingsRepository = {
  async get(propertyId: string): Promise<PropertySettings> {
    const snapshot = await getDoc(settingsRef(propertyId));
    return snapshot.exists() ? (snapshot.data() as PropertySettings) : DEFAULTS;
  },

  async update(
    propertyId: string,
    input: Partial<PropertySettings>,
  ): Promise<PropertySettings> {
    await setDoc(settingsRef(propertyId), input, { merge: true });
    return settingsRepository.get(propertyId);
  },

  subscribe(
    propertyId: string,
    callback: (settings: PropertySettings) => void,
  ): Unsubscribe {
    return onSnapshot(settingsRef(propertyId), (snapshot) => {
      callback(
        snapshot.exists() ? (snapshot.data() as PropertySettings) : DEFAULTS,
      );
    });
  },
};
```

- [ ] **Step 3: Rewrite `otherChargeRepository.ts`** to read/write the `otherChargeMasters` array on the same document (via `getDoc`/`setDoc` with `arrayUnion`/full-array replace — since edits are rare and admin-only, a read-modify-write on the array under a `runTransaction` avoids lost updates from two admins editing at once):

```ts
// src/data/repositories/otherChargeRepository.ts
import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  CreateOtherChargeInput,
  OtherChargeMaster,
  UpdateOtherChargeInput,
} from "@/types/otherCharge";

function settingsRef(propertyId: string) {
  return doc(db, "properties", propertyId, "settings", "general");
}

async function withMasters(
  propertyId: string,
  mutate: (masters: OtherChargeMaster[]) => OtherChargeMaster[],
): Promise<OtherChargeMaster[]> {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(settingsRef(propertyId));
    const current = (snapshot.data()?.otherChargeMasters ??
      []) as OtherChargeMaster[];
    const next = mutate(current);
    transaction.set(
      settingsRef(propertyId),
      { otherChargeMasters: next },
      { merge: true },
    );
    return next;
  });
}

export const otherChargeRepository = {
  async create(
    propertyId: string,
    input: CreateOtherChargeInput,
  ): Promise<OtherChargeMaster> {
    const now = new Date().toISOString();
    const created: OtherChargeMaster = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await withMasters(propertyId, (masters) => [...masters, created]);
    return created;
  },

  async update(
    propertyId: string,
    id: string,
    input: UpdateOtherChargeInput,
  ): Promise<OtherChargeMaster> {
    const now = new Date().toISOString();
    let updated: OtherChargeMaster | undefined;
    await withMasters(propertyId, (masters) =>
      masters.map((master) => {
        if (master.id !== id) return master;
        updated = { ...master, ...input, updatedAt: now };
        return updated;
      }),
    );
    if (!updated) throw new Error(`OtherChargeMaster ${id} not found`);
    return updated;
  },

  async delete(propertyId: string, id: string): Promise<void> {
    await withMasters(propertyId, (masters) =>
      masters.filter((master) => master.id !== id),
    );
  },
};
```

- [ ] **Step 4: `useSettings`/`useOtherCharges` become `onSnapshot`-driven**

```ts
// src/hooks/useSettings.ts
export function useSettings() {
  const propertyId = getActivePropertyId();
  const [settings, setSettings] = useState<PropertySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = settingsRepository.subscribe(propertyId, (next) => {
      setSettings(next);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [propertyId]);

  const updateSettings = useCallback(
    (input: Partial<PropertySettings>) =>
      settingsRepository.update(propertyId, input),
    [propertyId],
  );

  return { settings, isLoading, updateSettings };
}
```

`useOtherCharges` reads `settings?.otherChargeMasters ?? []` from the same subscription (it does not need its own `onSnapshot` — one document listener already covers both) and exposes `createOtherCharge`/`updateOtherCharge`/`deleteOtherCharge` calling into `otherChargeRepository`.

- [ ] **Step 5: `SettingsPage.tsx` loading branch**

Add, before the existing render body: `if (isLoading || !settings) return <PageSpinner />;` — everything else in the page is unchanged (it already receives `settings` as a plain object).

- [ ] **Step 6: Remove seed/migration call sites**

In `src/main.tsx`, remove the `seedIfEmpty()` and `legacyChargeMigration()`/`tenantNameMigration()` calls (the latter's file can also be deleted now — `Tenant.name` is already correct after Phase 0, and there's no legacy data to migrate per the spec).

- [ ] **Step 7: Manual smoke test**

With the emulators running and the manually-bootstrapped property/settings doc (Decision C) in place, open Settings in the browser: verify the form loads current values, editing rates/note persists and survives a refresh, and adding/editing/deactivating an Other Charge Master works and is reflected immediately (test with two browser tabs open to confirm `onSnapshot` pushes the update to the second tab without a manual refresh).

- [ ] **Step 8: Verify and commit**

Run: `pnpm build && pnpm lint`

```bash
git add -A
git commit -m "refactor: migrate settings and other-charge-masters repositories to Firestore"
```

---

## Task 3: Rooms & Tenants migration

**Goal:** `properties/{propertyId}/rooms` and `properties/{propertyId}/tenants` become the live source of truth, via the shared generic CRUD factory this phase introduces (reused as-is by nothing else needing simple CRUD — Assignments and Billing need transactions, so they don't use this factory beyond reads).

**Files:**

- Create: `src/data/repositories/firestoreCrud.ts` (generic factory)
- Modify: `src/data/repositories/roomRepository.ts`, `src/data/repositories/tenantRepository.ts`, `src/hooks/useRooms.ts`, `src/hooks/useTenants.ts`, `src/features/rooms/RoomsPage.tsx`, `src/features/tenants/TenantsPage.tsx` (loading branch; delete-guard error surfacing — see Step 4)

**Interfaces:**

- Produces: `createFirestoreCrudRepository<T>(collectionPath: (propertyId: string) => CollectionReference)` returning `{ getAll, subscribe, create, update, delete }`.
- Consumes: `getActivePropertyId()` (Phase 2).

- [ ] **Step 1: Generic CRUD factory**

```ts
// src/data/repositories/firestoreCrud.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type CollectionReference,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export function createFirestoreCrudRepository<
  TDoc extends { id: string },
  TCreateInput,
  TUpdateInput,
>(subcollectionName: string) {
  function collectionRef(propertyId: string): CollectionReference {
    return collection(db, "properties", propertyId, subcollectionName);
  }

  return {
    async getAll(propertyId: string): Promise<TDoc[]> {
      const snapshot = await getDocs(collectionRef(propertyId));
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TDoc);
    },

    subscribe(
      propertyId: string,
      callback: (items: TDoc[]) => void,
    ): Unsubscribe {
      return onSnapshot(collectionRef(propertyId), (snapshot) => {
        callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TDoc));
      });
    },

    async create(propertyId: string, input: TCreateInput): Promise<string> {
      const ref = await addDoc(collectionRef(propertyId), {
        ...input,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },

    async update(
      propertyId: string,
      id: string,
      input: TUpdateInput,
    ): Promise<void> {
      await updateDoc(doc(collectionRef(propertyId), id), {
        ...input,
        updatedAt: serverTimestamp(),
      });
    },

    async delete(propertyId: string, id: string): Promise<void> {
      await deleteDoc(doc(collectionRef(propertyId), id));
    },
  };
}
```

- [ ] **Step 2: `roomRepository.ts` on top of the factory**

```ts
// src/data/repositories/roomRepository.ts
import { createFirestoreCrudRepository } from "@/data/repositories/firestoreCrud";
import type { CreateRoomInput, Room, UpdateRoomInput } from "@/types/room";

export const roomRepository = createFirestoreCrudRepository<
  Room,
  CreateRoomInput,
  UpdateRoomInput
>("rooms");
```

`tenantRepository.ts` is the same three lines with `Tenant`/`CreateTenantInput`/`UpdateTenantInput`/`"tenants"`.

- [ ] **Step 3: `useRooms`/`useTenants` on `onSnapshot`**

```ts
// src/hooks/useRooms.ts
export function useRooms() {
  const propertyId = getActivePropertyId();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = roomRepository.subscribe(propertyId, (next) => {
      setRooms(next);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [propertyId]);

  const createRoom = useCallback(
    (input: CreateRoomInput) => roomRepository.create(propertyId, input),
    [propertyId],
  );
  const updateRoom = useCallback(
    (id: string, input: UpdateRoomInput) =>
      roomRepository.update(propertyId, id, input),
    [propertyId],
  );
  const deleteRoom = useCallback(
    (id: string) => roomRepository.delete(propertyId, id),
    [propertyId],
  );

  return { rooms, isLoading, createRoom, updateRoom, deleteRoom };
}
```

No `refresh()` — the `onSnapshot` subscription already reflects every mutation, including ones made from other tabs/users. Any call site that previously called `refresh()` after a mutation should simply remove that call. `useTenants` mirrors this exactly.

- [ ] **Step 4: Delete guard for rooms/tenants with assignment history**

Today's `roomRepository.delete()`/`tenantRepository.delete()` have no guard at all — deleting a room with billing/assignment history silently orphans that history. The old backend added this guard; carrying it over now (rather than deferring to Phase 4) avoids a real data-integrity regression the moment Rooms/Tenants go live. Add, in `roomRepository.ts` (wrapping the factory's `delete`):

```ts
async function assertNoActiveAssignment(
  propertyId: string,
  roomId: string,
): Promise<void> {
  const active = await getDocs(
    query(
      collection(db, "properties", propertyId, "assignments"),
      where("roomId", "==", roomId),
      where("status", "==", "active"),
    ),
  );
  if (!active.empty)
    throw new Error("Cannot delete a room with an active tenant assignment");
}

export const roomRepository = {
  ...createFirestoreCrudRepository<Room, CreateRoomInput, UpdateRoomInput>(
    "rooms",
  ),
  async delete(propertyId: string, id: string): Promise<void> {
    await assertNoActiveAssignment(propertyId, id);
    await deleteDoc(doc(db, "properties", propertyId, "rooms", id));
  },
};
```

(This reads the `assignments` collection before it's populated by Phase 4 — harmless, it will just always find zero active assignments until then. `tenantRepository` gets the equivalent guard keyed on `tenantId`.) Surface the thrown error as a toast in `RoomsPage.tsx`/`TenantsPage.tsx`'s existing delete-confirmation handler (they already have a try/catch pattern for repository calls — extend it, don't add a new one).

- [ ] **Step 5: Loading branches**

Same one-line pattern as Phase 2's `SettingsPage.tsx`, applied to `RoomsPage.tsx` and `TenantsPage.tsx`.

- [ ] **Step 6: Manual smoke test**

Create/edit/delete a room and a tenant in the browser against the emulator; confirm live update across two tabs; confirm deleting a room/tenant that has no assignments still works (the guard added in Step 4 shouldn't block the common case).

- [ ] **Step 7: Verify and commit**

Run: `pnpm build && pnpm lint`

```bash
git add -A
git commit -m "refactor: migrate rooms and tenants repositories to Firestore"
```

---

## Task 4: Assignments migration with transactional consistency

**Goal:** Port the assign/end business logic — currently only implemented correctly in the (deleted) Cloud Functions backend — into client-side `runTransaction()` calls, since this is the read-modify-write path the spec explicitly calls out as needing Firestore transactions.

**Files:**

- Modify: `src/data/repositories/assignmentRepository.ts` (full rewrite), `src/hooks/useAssignments.ts`, `src/types/assignment.ts` (add `updatedAt`, per the schema note above)

**Interfaces:**

- Consumes: `roomRepository`/`tenantRepository` collection paths (Phase 3) — the transaction reads/writes room and tenant documents directly via `doc()`, not through those repositories' functions (transactions need raw refs).
- Produces: `assignmentRepository.assign(propertyId, input): Promise<RoomTenantAssignment>`, `assignmentRepository.endByRoomId(propertyId, roomId, endDate): Promise<void>`.

- [ ] **Step 1: Add `updatedAt` to the `RoomTenantAssignment` type**

In `src/types/assignment.ts`:

```ts
export interface RoomTenantAssignment {
  id: string;
  roomId: string;
  tenantId: string;
  startDate: string;
  endDate?: string;
  status: "active" | "ended";
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Transactional `assign()`**, porting `functions/src/services/assignments.service.js`'s logic (captured in the audit above) to the client SDK:

```ts
// src/data/repositories/assignmentRepository.ts
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  CreateAssignmentInput,
  RoomTenantAssignment,
} from "@/types/assignment";

function assignmentsRef(propertyId: string) {
  return collection(db, "properties", propertyId, "assignments");
}

export const assignmentRepository = {
  async assign(
    propertyId: string,
    input: CreateAssignmentInput,
  ): Promise<string> {
    return runTransaction(db, async (transaction) => {
      const roomRef = doc(db, "properties", propertyId, "rooms", input.roomId);
      const tenantRef = doc(
        db,
        "properties",
        propertyId,
        "tenants",
        input.tenantId,
      );
      const [roomSnap, tenantSnap] = await Promise.all([
        transaction.get(roomRef),
        transaction.get(tenantRef),
      ]);
      if (!roomSnap.exists()) throw new Error("Room not found");
      if (!tenantSnap.exists()) throw new Error("Tenant not found");
      const room = roomSnap.data();
      const tenant = tenantSnap.data();
      if (room.status === "maintenance" || room.status === "inactive") {
        throw new Error("Room is not available for assignment");
      }
      if (tenant.status !== "active") throw new Error("Tenant is not active");

      const [activeForRoom, activeForTenant] = await Promise.all([
        transaction.get(
          query(
            assignmentsRef(propertyId),
            where("roomId", "==", input.roomId),
            where("status", "==", "active"),
          ),
        ),
        transaction.get(
          query(
            assignmentsRef(propertyId),
            where("tenantId", "==", input.tenantId),
            where("status", "==", "active"),
          ),
        ),
      ]);
      if (!activeForRoom.empty)
        throw new Error("Room already has an active tenant");
      if (!activeForTenant.empty)
        throw new Error("Tenant already has an active room assignment");

      const assignmentRef = doc(assignmentsRef(propertyId));
      transaction.set(assignmentRef, {
        roomId: input.roomId,
        tenantId: input.tenantId,
        startDate: Timestamp.fromDate(new Date(input.startDate)),
        endDate: null,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(roomRef, {
        status: "occupied",
        updatedAt: serverTimestamp(),
      });
      // No-op field touch on the tenant doc — forces Firestore's optimistic
      // concurrency check to detect two simultaneous assign() calls for the
      // same tenant and retry one of them, closing the race the two reads
      // above can't close on their own. Mirrors the deleted backend's
      // identical trick (see assignments.service.js in the audit).
      transaction.update(tenantRef, { updatedAt: serverTimestamp() });
      return assignmentRef.id;
    });
  },

  async endByRoomId(
    propertyId: string,
    roomId: string,
    endDate: string,
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const activeSnap = await transaction.get(
        query(
          assignmentsRef(propertyId),
          where("roomId", "==", roomId),
          where("status", "==", "active"),
        ),
      );
      if (activeSnap.empty) return;
      const assignmentDoc = activeSnap.docs[0];
      const roomRef = doc(db, "properties", propertyId, "rooms", roomId);
      const roomSnap = await transaction.get(roomRef);

      transaction.update(assignmentDoc.ref, {
        status: "ended",
        endDate: Timestamp.fromDate(new Date(endDate)),
        updatedAt: serverTimestamp(),
      });
      if (roomSnap.exists() && roomSnap.data().status === "occupied") {
        transaction.update(roomRef, {
          status: "available",
          updatedAt: serverTimestamp(),
        });
      }
    });
  },
};
```

Two deliberate differences from a literal port of the backend, both flagged for your review during Phase 4's review step rather than silently made: (1) the backend's `create()`/`end()` take an explicit assignment ID and do extra 404/409 checks with typed `AppError` codes the UI never read individually (it only ever showed a generic error toast) — this version throws plain `Error`s with the same messages, since there's no HTTP layer translating error codes anymore; (2) `endByRoomId` (matching today's frontend repository's existing signature, used by `RoomDetailSheet`) queries for the active assignment rather than taking its ID directly, exactly matching current call sites — the backend's equivalent took an assignment ID because its callers already had it from a list view.

- [ ] **Step 3: `useAssignments` becomes async + `onSnapshot`**

**Timestamp/string soundness (learned from Task 3's review — apply it here up front instead of by fix round):** `startDate`/`endDate`/`createdAt`/`updatedAt` are written as Firestore `Timestamp`s (Step 2) but the domain type declares all four as ISO strings (`startDate: string`, `endDate?: string`, `createdAt: string`, `updatedAt: string`). Convert on read through a small local helper, the same pattern Task 3's `firestoreCrud.ts` uses:

```ts
function toAssignment(
  id: string,
  data: Record<string, unknown>,
): RoomTenantAssignment {
  return {
    id,
    ...data,
    startDate:
      timestampToIso(data.startDate as Timestamp | null | undefined) ??
      new Date().toISOString(),
    endDate: timestampToIso(data.endDate as Timestamp | null | undefined),
    createdAt:
      timestampToIso(data.createdAt as Timestamp | null | undefined) ??
      new Date().toISOString(),
    updatedAt:
      timestampToIso(data.updatedAt as Timestamp | null | undefined) ??
      new Date().toISOString(),
  } as RoomTenantAssignment;
}
```

(`endDate` is allowed to stay `undefined` — unlike `createdAt`/`startDate`, the type already makes it optional, and `timestampToIso(null)` correctly returns `undefined` for the common "still active, no end date" case. Import `timestampToIso` from `@/data/repositories/converters/timestamp`, per Task 2.)

```ts
export function useAssignments() {
  const propertyId = getActivePropertyId();
  const [assignments, setAssignments] = useState<RoomTenantAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "properties", propertyId, "assignments"),
      (snapshot) => {
        setAssignments(snapshot.docs.map((d) => toAssignment(d.id, d.data())));
        setIsLoading(false);
      },
    );
    return unsubscribe;
  }, [propertyId]);

  const assignTenant = useCallback(
    (input: CreateAssignmentInput) =>
      assignmentRepository.assign(propertyId, input),
    [propertyId],
  );
  const endTenancyByRoomId = useCallback(
    (roomId: string, endDate: string) =>
      assignmentRepository.endByRoomId(propertyId, roomId, endDate),
    [propertyId],
  );
  const getActiveByRoomId = useCallback(
    (roomId: string) =>
      assignments.find((a) => a.roomId === roomId && a.status === "active"),
    [assignments],
  );
  const getActiveByTenantId = useCallback(
    (tenantId: string) =>
      assignments.find((a) => a.tenantId === tenantId && a.status === "active"),
    [assignments],
  );

  return {
    assignments,
    isLoading,
    assignTenant,
    endTenancyByRoomId,
    getActiveByRoomId,
    getActiveByTenantId,
  };
}
```

`getActiveByRoomId`/`getActiveByTenantId` stay synchronous lookups over the already-subscribed local array — they don't need their own Firestore read, since the whole collection is already live in memory (same as today's `localStorage`-backed version, just sourced differently).

- [ ] **Step 4: "Move tenant to a different room" business rule**

`TenantsPage.tsx`'s move-room flow (documented in `context.md`'s Business Rules — checks for an existing active assignment before assigning the new one, ending the old one first if the room differs) is unchanged UI-side; it now calls `endTenancyByRoomId` then `assignTenant`, both transactional, sequentially — this is not itself wrapped in one bigger transaction (two separate transactions), matching today's already-non-atomic two-call behavior. Note this explicitly rather than silently leaving it as a gap: a crash between the two calls could leave a tenant unassigned rather than moved. This matches the pre-existing behavior exactly (today's `localStorage` version has the identical gap), so it is not a regression — call it out here so it isn't mistaken for an oversight if it comes up later.

- [ ] **Step 5: Manual smoke test**

Assign a tenant to a room, confirm room status flips to occupied and the assignment appears live in a second tab; try assigning the same tenant to a second room and confirm it's rejected; end the tenancy and confirm the room returns to available (and that a room manually set to `maintenance` does NOT flip back to `available` when its assignment ends — this is the guard from `context.md`'s Business Rules, preserved in Step 2's `endByRoomId`).

- [ ] **Step 6: Verify and commit**

Run: `pnpm build && pnpm lint`

```bash
git add -A
git commit -m "refactor: migrate assignments repository to Firestore with transactional consistency"
```

---

## Task 5: Billing migration with transactional invoice issuance

**Goal:** `properties/{propertyId}/billing` becomes Firestore-backed with a deterministic `${roomId}_${billingMonth}` ID (preventing double-billing a room for the same month) and a transactional issuance step that assigns `invoiceNumber` safely under concurrent writers (Decision A — no separate `invoices`/`counters` collections).

**Files:**

- Modify: `src/data/repositories/billingRepository.ts` (full rewrite), `src/hooks/useBillingRecords.ts`, `src/lib/invoice.ts` (the pure `generateInvoiceNumber`/`resolveBillingStatus` functions are reused, not rewritten — see Step 2), `src/features/billing/BillingPage.tsx`, `src/features/billing/BillingFormDialog.tsx`, `src/features/invoices/InvoicesPage.tsx` (loading branches)

**Interfaces:**

- Consumes: `src/lib/invoice.ts`'s existing `generateInvoiceNumber(billingMonth, existing): string` and `resolveBillingStatus(record): BillingStatus` — both pure functions, untouched.
- Produces: `billingRepository.create(propertyId, input): Promise<string>`, `billingRepository.update(propertyId, id, input): Promise<{ invoiceNumber: string | null }>` (handles the draft→issued transition transactionally when `status` changes to `"issued"`; resolves with the record's `invoiceNumber` — `null` if this update didn't issue it — since `BillingPage.tsx`'s single-row "Issue" action shows it in a success toast immediately, before the next `onSnapshot` tick would otherwise deliver it), `billingRepository.delete(propertyId, id): Promise<void>`.

**A required ripple this task's brief covers up front (learned from Tasks 3-4's reviews — the same "async repository call fire-and-forget from a form/handler" bug class shows up here too, in three places):** `src/features/billing/BillingFormDialog.tsx`'s `handleSubmit()` calls the (now Promise-returning) `onSubmit(input)` synchronously, exactly like `RoomFormDialog.tsx`/`TenantFormDialog.tsx` did before Task 3's fix round. `BillingPage.tsx` has three more call sites with the identical problem: its `onSubmit` passed to `BillingFormDialog` discards the `createBilling`/`updateBilling` promise (same pattern as `RoomsPage.tsx` before its fix); its `BillingTable`'s `onIssue` handler does `const updated = updateBilling(record.id, { status: "issued" })` and immediately reads `updated.invoiceNumber` — this only works if `update()`'s return type actually resolves with the new `invoiceNumber` (see the `Produces` line above) and the call is awaited; and `handleBulkIssue()` loops `for (const id of ids) { updateBilling(id, { status: "issued" }); }` synchronously — this MUST become a sequential `for...of` loop with `await` on each iteration (not `Promise.all`), because the whole point of Step 2's transaction (each issuance reading the freshest "existing records for this month" state) depends on one issuance's write committing before the next one reads — firing them concurrently would defeat that and risk two bills computing the same sequence number before either commits. Step 5 below covers this in detail; don't defer it to a review cycle.

- [ ] **Step 1: Deterministic-ID create, non-transactional path for drafts**

Creating or editing a `draft` bill doesn't need a transaction by itself (no cross-document invariant besides "one bill per room per month," which the deterministic ID already enforces at the Firestore level — a second `setDoc` with `{ merge: false }`-equivalent semantics on an existing doc ID is an overwrite, so the create path must check-then-create; a plain create races the same way `localStorage` never could, hence still wrapping it in a transaction to make the existence check atomic with the write):

**Timestamp/string soundness and the undefined-field crash (learned from Task 3's review — apply both up front instead of by fix round):** `BillingRecord`'s `dueDate`/`issuedAt`/`paidAt`/`createdAt`/`updatedAt` are Firestore `Timestamp`s at rest but ISO strings (or `null`/`undefined`) in the domain type — every read needs conversion, exactly like Task 4's `toAssignment()`. Separately, `CreateBillingInput`/`UpdateBillingInput` have optional fields (`tenantId?`, `dueDate?`, etc., commonly built as `value || undefined` by the form) — spreading `...input` straight into a transactional write crashes exactly like Task 3's Critical finding did, so strip `undefined` before every write here too. `billingRepository.ts` doesn't use the Task 3 generic factory (it needs bespoke transactions), so define small local equivalents rather than importing Task 3's private, unexported `firestoreCrud.ts` helper — a few duplicated lines of a 2-line utility is fine per YAGNI; don't refactor Task 3's already-shipped, already-reviewed file to export it just to save this duplication.

```ts
// src/data/repositories/billingRepository.ts
import {
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calculateBillingTotals } from "@/lib/calculations";
import { generateInvoiceNumber } from "@/lib/invoice";
import {
  timestampToIso,
  isoToTimestamp,
} from "@/data/repositories/converters/timestamp";
import type {
  BillingRecord,
  CreateBillingInput,
  UpdateBillingInput,
} from "@/types/billing";

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function billingDocId(roomId: string, billingMonth: string): string {
  return `${roomId}_${billingMonth}`;
}

function billingRef(propertyId: string, roomId: string, billingMonth: string) {
  return doc(
    db,
    "properties",
    propertyId,
    "billing",
    billingDocId(roomId, billingMonth),
  );
}

export const billingRepository = {
  async create(propertyId: string, input: CreateBillingInput): Promise<string> {
    const id = billingDocId(input.roomId, input.billingMonth);
    const totals = calculateBillingTotals(input);
    await runTransaction(db, async (transaction) => {
      const ref = billingRef(propertyId, input.roomId, input.billingMonth);
      const existing = await transaction.get(ref);
      if (existing.exists()) {
        throw new Error("A bill for this room and month already exists");
      }
      transaction.set(ref, {
        ...stripUndefined(input as unknown as Record<string, unknown>),
        ...totals,
        dueDate: input.dueDate ? isoToTimestamp(input.dueDate) : null,
        status: "draft",
        invoiceNumber: null,
        issuedAt: null,
        paidAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return id;
  },
  // update()/delete() in Step 2
};
```

(`dueDate` is set explicitly, overriding whatever raw string `stripUndefined(input)` left in place, so it's always stored as a proper `Timestamp` — consistent with `issuedAt`/`paidAt`/`createdAt`/`updatedAt`, and with the "persist as Firestore `Timestamp`" rule in this plan's Firestore Schema section above.)

- [ ] **Step 2: Transactional issuance inside `update()`**

```ts
  async update(propertyId: string, id: string, input: UpdateBillingInput): Promise<{ invoiceNumber: string | null }> {
    const ref = doc(db, "properties", propertyId, "billing", id);
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("Billing record not found");
      const currentRaw = snapshot.data();
      // `currentRaw`'s date fields are raw Firestore Timestamps here, not the
      // ISO strings `BillingRecord` declares — fine for this function's own
      // use (billingMonth/invoiceNumber/status are plain strings, unaffected;
      // issuedAt is only ever round-tripped Timestamp-to-Timestamp below,
      // never read as a string) but do NOT cast this to `BillingRecord` and
      // hand it elsewhere — that mistake is exactly Task 3's Important finding.
      const willIssueNow = input.status === "issued" && currentRaw.status !== "issued";

      let invoiceNumber: string | null = currentRaw.invoiceNumber ?? null;
      if (willIssueNow) {
        const monthSnapshot = await transaction.get(
          query(
            collection(db, "properties", propertyId, "billing"),
            where("billingMonth", "==", currentRaw.billingMonth),
          ),
        );
        const existingForMonth = monthSnapshot.docs
          .map((d) => d.data() as BillingRecord)
          .filter((record) => record.invoiceNumber);
        invoiceNumber = generateInvoiceNumber(currentRaw.billingMonth, existingForMonth);
      }

      const totals = calculateBillingTotals({ ...currentRaw, ...input } as unknown as BillingRecord);
      transaction.update(ref, {
        ...stripUndefined(input as unknown as Record<string, unknown>),
        ...totals,
        invoiceNumber,
        ...(input.dueDate !== undefined ? { dueDate: isoToTimestamp(input.dueDate) } : {}),
        issuedAt: willIssueNow ? serverTimestamp() : (currentRaw.issuedAt ?? null),
        updatedAt: serverTimestamp(),
      });
      return { invoiceNumber };
    });
  },

  async delete(propertyId: string, id: string): Promise<void> {
    await deleteDoc(doc(db, "properties", propertyId, "billing", id));
  },
```

This reuses `generateInvoiceNumber` completely unchanged from `src/lib/invoice.ts` — the only thing that moved is _where_ the "existing records for this month" list comes from (a transactional query instead of a synchronous in-memory array), and the fact that the check-then-write now happens inside a transaction so two admins issuing bills for the same property/month at the same moment can't compute the same sequence number twice (Firestore retries the loser of the race, which then re-reads and sees the winner's committed `invoiceNumber`).

⚠️ **`monthSnapshot.docs.map((d) => d.data() as BillingRecord)` above is deliberately left as a bare cast, not run through a converter** — `generateInvoiceNumber`/its `.filter((record) => record.invoiceNumber)` only touch `invoiceNumber` (a plain string/null field, never a Timestamp), so the cast is safe here specifically. Don't copy this line as a general pattern elsewhere.

- [ ] **Step 3: `useBillingRecords` on `onSnapshot`**

Same Timestamp/string conversion need as Task 4's `toAssignment()` — `issuedAt`/`dueDate`/`paidAt`/`createdAt`/`updatedAt` all need converting on read:

```ts
function toBillingRecord(
  id: string,
  data: Record<string, unknown>,
): BillingRecord {
  return {
    id,
    ...data,
    issuedAt: timestampToIso(data.issuedAt as Timestamp | null | undefined),
    dueDate: timestampToIso(data.dueDate as Timestamp | null | undefined),
    paidAt: timestampToIso(data.paidAt as Timestamp | null | undefined),
    createdAt:
      timestampToIso(data.createdAt as Timestamp | null | undefined) ??
      new Date().toISOString(),
    updatedAt:
      timestampToIso(data.updatedAt as Timestamp | null | undefined) ??
      new Date().toISOString(),
  } as BillingRecord;
}
```

Otherwise same shape as Task 3/4's hooks — subscribe to `properties/{propertyId}/billing` via `onSnapshot`, mapping every doc through `toBillingRecord`, no query filters (client-side filtering in `BillingPage.tsx`/`InvoicesPage.tsx` is completely unchanged, per the Indexes section's reasoning), expose `isLoading`, `createBilling`, `updateBilling`, `deleteBilling`.

- [ ] **Step 4: `BillingPage.tsx`/`InvoicesPage.tsx` loading branches**

Same one-line pattern as prior phases. No other change — `resolveBillingStatus()` (unchanged pure function) still computes `overdue` at render time from `dueDate`, exactly as today.

- [ ] **Step 5: Fix the three swallowed-promise call sites (`BillingFormDialog.tsx`, `BillingPage.tsx`) — same bug class Tasks 3-4's reviews caught, apply it up front this time**

Read the current `src/features/billing/BillingFormDialog.tsx` and `src/features/billing/BillingPage.tsx` in full before touching them — the following describes their current (pre-Task-5) shape exactly, verified against the real files:

1. **`BillingFormDialog.tsx`'s `handleSubmit()`** calls `onSubmit(input)` synchronously, then unconditionally `toast.success(...)` + `onOpenChange(false)` — identical to `RoomFormDialog.tsx`/`TenantFormDialog.tsx` before Task 3's fix. Apply the exact same fix: change the `onSubmit` prop's type to return `Promise<unknown>`, make `handleSubmit` `async`, `await onSubmit(input)` in a try/catch — success path unchanged, failure path `toast.error(t("common.actionFailed"))` and leave the dialog open with the user's input intact. Add the same `isSubmitting` double-submit guard (disable both buttons during the await) that `RoomFormDialog.tsx`/`TenantFormDialog.tsx` already have — copy that established pattern, don't reinvent it.
2. **`BillingPage.tsx`'s `onSubmit` passed to `BillingFormDialog`** (`onSubmit={(input) => { if (editingRecord) { updateBilling(...) } else { createBilling(...) } }}`) discards the promise — fix identically to `RoomsPage.tsx`/`TenantsPage.tsx`: return it (expression-bodied arrow or explicit `return`).
3. **`BillingTable`'s `onIssue` handler** (`const updated = updateBilling(record.id, { status: "issued" }); toast.success(t("billing.issuedToast", { invoiceNumber: updated.invoiceNumber ?? "" }));`) currently assumes a synchronous return with `.invoiceNumber` on it. With Step 2's `update()` now `async` and resolving `{ invoiceNumber: string | null }` (not the full record — see this task's `Produces` line above), change this to `await` the call and read `.invoiceNumber` off the resolved `{ invoiceNumber }`, wrapped in try/catch with the same `common.actionFailed` fallback on failure. `onMarkPaid` needs the identical await+catch treatment (it doesn't need the resolved value, just error handling).
4. **`handleBulkIssue()`** (`for (const id of ids) { updateBilling(id, { status: "issued" }); }`) — this is the one that actually matters for correctness, not just UX: change to a sequential `for...of` loop that `await`s each `updateBilling(id, { status: "issued" })` before moving to the next `id`. This MUST stay sequential (not `Promise.all`) — `context.md`'s Business Rules documents this exact requirement for the pre-Firestore version ("safe because `billingRepository.update()` re-reads `localStorage` on every call, so `generateInvoiceNumber()` sees each prior issuance and increments correctly within the same batch"), and Step 2's transaction preserves that same guarantee only if each transaction's write commits before the next one's read starts — firing them concurrently would let multiple transactions read the same "existing records for this month" snapshot before any of them commit, risking (Firestore will still prevent an actual duplicate `invoiceNumber` via the retry mechanism, but wastefully — several transactions would retry against each other rather than each cleanly succeeding in sequence). Wrap the loop body in try/catch per iteration: on failure, stop issuing further records in the batch (don't silently continue past a failure), report which ids succeeded vs. the id that failed via the existing toast pattern, then still call `setSelectedIds(new Set())` only for successfully-issued ids (or all attempted ids if you judge that simpler — use your judgment, but don't silently claim full success when only some of the batch went through).

Every new user-facing string in this step must go through `t("common.actionFailed")` (already exists, added in Task 3's fix round) or another already-existing key — do not add new i18n keys for this step; the generic fallback is sufficient here, unlike Task 3's delete-guard case which had a more specific message worth naming.

- [ ] **Step 6: Manual smoke test**

Create a draft bill, verify no `invoiceNumber` yet; issue it, verify `INV-YYYY-MM-001` appears; create and issue a second bill for the same month/property, verify it gets `-002`; attempt to create a second bill for the same room+month and confirm it's rejected; use "Issue Selected" on 2–3 draft bills at once and confirm sequential, non-colliding invoice numbers.

- [ ] **Step 7: Verify and commit**

Run: `pnpm build && pnpm lint`

```bash
git add -A
git commit -m "refactor: migrate billing repository to Firestore with transactional invoice issuance"
```

---

## Task 6: Role-gated UI, docs, and final verification

**Goal:** Close the frontend RBAC gap the audit found (no page currently checks `user.role`, even though only `admin` can write per the rules from Phase 1), rewrite the now-stale docs, and do one full manual pass of the deployed-shape build.

**Files:**

- Modify: `src/features/rooms/RoomsPage.tsx`, `src/features/tenants/TenantsPage.tsx`, `src/features/billing/BillingPage.tsx`, `src/features/settings/SettingsPage.tsx` (hide/disable create/edit/delete affordances when `useAuth().user.role !== "admin"`), `README.md`, `docs/firebase/data-model.md`, `docs/firebase/setup.md`, `context.md`
- Delete (if not already gone by Phase 1): any remaining `docs/adr/0003-*`, any stray `docs/firebase/{backend,api,authentication}.md`

- [ ] **Step 1: Role-gate write affordances**

In each listed page, wrap the existing "Add"/"Edit"/"Delete" buttons with `{user.role === "admin" && (...)}` — this is UX only (Firestore rules from Phase 1 are the actual enforcement; a `staff` user who somehow triggers a write anyway gets a rejected Firestore write, not a security hole). Don't add a generic `<RequireRole>` abstraction for four call sites — inline the check, matching the codebase's existing preference for concrete code over premature abstraction (per `context.md`'s Development Guidelines).

- [ ] **Step 2: Rewrite `README.md`**

Remove the demo-auth section and the "Firebase Backend (Cloud Functions)" section entirely. Add:

- An updated "Authentication" section describing Firebase Auth + `users/{uid}` Firestore profile (no backend).
- A "First-Time Setup" section documenting Decision C's manual bootstrap steps (create Auth user, create `properties/{propertyId}`, `properties/{propertyId}/settings/general`, `users/{uid}` by hand via Console or the emulator UI).
- Updated `pnpm dev` / `firebase emulators:start --only auth,firestore` instructions (no `--only functions`, no `functions` emulator).

- [ ] **Step 3: Rewrite `docs/firebase/data-model.md`**

Replace the top-level-collections design with this plan's Firestore Schema section (subcollections, no `invoices`/`counters`, embedded `otherChargeMasters`). Keep the "Snapshot strategy"/"Business rules" framing where it still applies (assignment exclusivity, room-status coordination), drop anything specific to the deleted backend (API endpoint tables, `AppError` codes).

- [ ] **Step 4: Rewrite `docs/firebase/setup.md`**

Remove Functions-region/emulator instructions; keep Firebase project setup, `.env.local` instructions, and Firestore+Auth emulator usage.

- [ ] **Step 5: Update `context.md`**

Update the Authentication, Firebase Migration, Storage Keys, and Domain Model sections to describe the final state: no backend, Firestore-direct repositories, the schema from this plan, and the `Tenant.name` fix from Phase 0. This file is the project's own single source of truth per its own Development Guidelines ("Update this file after any meaningful architecture or feature change") — don't skip it.

- [ ] **Step 6: Full manual regression pass**

With `firebase emulators:start --only auth,firestore` and `pnpm dev` running against a freshly bootstrapped property/admin user: walk every page (Dashboard, Rooms, Tenants, Billing, Invoices, Settings, invoice print view) end to end, in both languages (Thai/English) and both a light and dark appearance, confirming no regression versus the pre-migration `localStorage` behavior documented in `context.md`'s Feature Status table. Additionally log in as a `staff`-role user (create a second Auth user + `users/{uid}` doc by hand) and confirm write affordances are hidden and that a direct Firestore write attempt (e.g., via browser devtools) is rejected by the rules from Phase 1.

- [ ] **Step 7: Final verify and commit**

Run: `pnpm build && pnpm lint`

```bash
git add -A
git commit -m "docs: update README and Firebase docs for the direct-Firestore architecture; gate write UI by role"
```

---

## Self-Review Notes

- **Spec coverage:** Firebase Auth as source of truth (Phase 1), profile/authorization from `users/{uid}` (Phase 1), `onAuthStateChanged` + direct Firestore profile load (Phase 1), deletion of API client/`VITE_API_BASE_URL`/`fetchCurrentUserProfile`/Cloud Functions (Phase 1), repository migration to the five named Firestore paths (Phases 2–5, with Decisions A/B explaining the two additions/omissions), async repositories + `onSnapshot` (Phases 2–5), transactions for assignment/room-status/invoice-number (Phases 4–5), Security Rules scoped by `users/{uid}.propertyIds` (Phase 1's ruleset), no Cloud Functions/server proxy/client-only security (ruleset design + Risks section below), GitHub Pages base path (unchanged, confirmed compatible in the audit), env/docs updates (Phase 1 + Phase 6), Cloud Functions folder deletion once confirmed unused (Phase 1, confirmed via the audit's grep that nothing outside `functions/`/`src/api/` references it), typecheck/lint/build after each phase (every phase's last two steps).
- **Placeholder scan:** every code block above is a complete, non-hand-waved implementation of its function; the two places that reuse a shared implementation instead of repeating it (the `firestoreCrud.ts` factory for rooms/tenants, and `generateInvoiceNumber`/`resolveBillingStatus` reused unchanged for billing) are named DRY decisions with the actual shared code shown, not "similar to Task N."
- **Type consistency:** `AuthUser` shape is unchanged end-to-end (Phase 1's service/context); `RoomTenantAssignment` gains `updatedAt` in Phase 4 and every later reference to it (Step 3's hook) includes the field; every hook's added `isLoading` (Decision D) is named identically across Phases 2–5.

## Risks and Known Limitations (surfaced, not hidden)

- **Client-trust ceiling:** removing the backend means Firestore Security Rules are the only thing stopping a malicious _admin_-role account from writing directly via the SDK and bypassing a transaction's invariant checks (e.g., writing two "active" assignments for one room by calling `setDoc` instead of going through `assignmentRepository.assign()`). The rules in Phase 1 catch property/role boundary violations but cannot cheaply catch every cross-document business invariant the old backend's transactions enforced. This is an accepted trade-off of the architecture the spec asks for, not an oversight — worth stating plainly rather than implying parity with the deleted backend's guarantees.
- **No automated regression suite:** this plan's verification is typecheck + lint + build + manual smoke testing, matching the spec's own stated gate and the project's current lack of any test framework. If a test framework gets added later, this plan's manual smoke-test steps are a ready-made source for the first batch of integration tests.
- **Single-admin bootstrap is manual and undocumented-until-Phase-6:** between Phase 1 landing and Phase 6's README rewrite, anyone else picking up this branch needs the Decision C steps described verbally — consider doing Phase 6's README section update opportunistically right after Phase 1 if multiple people will touch this branch before Phase 6 is reached.
