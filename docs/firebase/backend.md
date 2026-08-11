# Firebase Functions Backend

## Scope

Phase 3 (Steps 1–8) is complete: backend foundation, authentication/property scope, and full domain CRUD for properties, settings, other charges, rooms, tenants, assignments, billing, and invoices. The backend is fully implemented and verified against the Emulator Suite, but is not yet connected to the React app — the frontend still reads/writes `localStorage` unchanged. See [api.md](api.md) for the endpoint catalogue and [../../context.md](../../context.md) for the phase-by-phase history and Phase 4 integration notes.

## Architecture

```text
HTTP request
  ↓
Express (CORS, JSON body parsing)
  ↓
Middleware (requireAuth → requireRole → property access)
  ↓
Controller (thin: parses request, calls validator + service, shapes response)
  ↓
Service (business rules, Firestore transactions)
  ↓
Repository (Firestore Admin SDK reads/writes only)
  ↓
Firestore
```

Every domain resource (properties, settings, other-charges, rooms, tenants, assignments, billing, invoices) follows this same layering under `functions/src/{routes,controllers,services,repositories,validators}/`. Controllers never touch Firestore directly; repositories never see the HTTP request/response objects.

## Folder structure

```text
functions/
  .env.example
  package.json                oxlint, firebase-admin, firebase-functions, express, cors
  src/
    app.js                    Express composition root (CORS → JSON → routers → 404 → error middleware)
    index.js                  2nd gen HTTPS Cloud Function export
    config/
      firebase.js             singleton Firebase Admin App, Firestore, Auth
      cors.js                 configurable CORS middleware; fails closed outside the emulator (see ADR 0003)
    errors/
      app-error.js            reusable HTTP application error
      error-codes.js          centralized error code registry
    middleware/
      auth.middleware.js      Firebase ID token verification + user profile loading
      role.middleware.js      requireRole(...allowedRoles)
      error.middleware.js     centralized error + 404 handling
    routes|controllers|services|repositories|validators/
      {properties,settings,other-charges,rooms,tenants,assignments,billing,invoices}.*
    services/
      property-access.service.js   ensurePropertyAccess(user, propertyId) — shared property-scope guard
      users.service.js             loads/validates the Firestore user profile
    utils/
      response.js              sendSuccess / sendList / sendError helpers
      billing-calculator.js    usage/amount/subtotal/total math (see ADR 0001)
      invoice-number.js        INV-YYYY-MM-NNN formatting + counter document ID
    smoke-test.js, auth-foundation-test.js, resource-api-foundation-test.js
                               mocked-dependency unit tests (no emulator needed) — see `npm run test:*`
  scripts/
    seed-dev-user.js                       creates the local emulator admin user
    verify-auth-emulator.js                real-token auth flow against the emulator
    verify-resource-apis-emulator.js       properties/settings/other-charges against the emulator
    verify-assignments-emulator.js         assignment + concurrency checks against the emulator
```

`functions/src/config/firebase.js` initializes the Admin App once with `getApps()`/`getApp()` and exports `db` and `auth`. Routes must not initialize Firebase Admin themselves. The Admin SDK observes emulator environment variables supplied by the Firebase CLI; no frontend Firebase SDK or `VITE_*` configuration is used by the backend.

## API

The single 2nd gen HTTP function is `api`, serving everything below `/api/v1`. `GET /api/v1/health` is the only public (unauthenticated) route:

```json
{ "success": true, "data": { "status": "ok" } }
```

Every other route requires a Firebase ID token and is documented in [api.md](api.md), including permissions, request/response shapes, and business rules. Unknown routes return a JSON `404 NOT_FOUND` response. The centralized error middleware returns standardized `{ success: false, error: { code, message } }` errors and logs only minimal server-side diagnostic metadata (error code, method, path) for unexpected errors; it never sends stack traces, Firebase Admin SDK error objects, or Firestore internals to callers, in development or production.

## CORS

`CORS_ALLOWED_ORIGINS` is a comma-separated origin allow-list read at startup. In the Emulator Suite and in plain local `node` runs (smoke/unit test scripts), an empty list is allowed and reflects any origin, for local development convenience. In a real deployment — detected by the Cloud Run `K_SERVICE` environment variable, which only exists there — an empty list makes the function refuse to start — see [ADR 0003](../adr/0003-cors-fail-closed-outside-emulator.md). Set `CORS_ALLOWED_ORIGINS` to the real deployed frontend origin(s) before any production deploy.

## Firestore Security Rules

`firestore.rules` denies all direct client reads/writes (`allow read, write: if false`). All business CRUD goes exclusively through this Cloud Functions API, which uses the Admin SDK and therefore bypasses these rules by design. The rules exist to block any direct client-SDK access to Firestore, not to enforce authorization themselves — authorization is the API's job (see [authentication.md](authentication.md)).

## Local emulator

Install backend dependencies once:

```sh
pnpm --dir functions install
```

Copy `functions/.env.example` to an ignored local environment file if a non-default region or explicit CORS origins are needed. `FUNCTIONS_REGION` defaults to `asia-southeast1`; it must match the frontend Functions region when the frontend is integrated later. `CORS_ALLOWED_ORIGINS` is required outside the emulator (see CORS above); leave it empty for local development.

Start Functions, Firestore, and Authentication Emulator Suite:

```sh
pnpm --dir functions emulators --project demo-rental-property-management
```

The configured ports are Functions `5001`, Firestore `8080`, Authentication `9099`, and Emulator UI `4001`. A Firebase project alias is intentionally not committed because the repository has no assigned Firebase project yet. Replace the demo project ID with the chosen Firebase project when appropriate.

Run lint and the mocked-dependency unit tests (no emulator needed):

```sh
pnpm --dir functions lint            # oxlint
pnpm --dir functions test:smoke      # Admin App/Auth/Firestore wiring, health, 404 handling
pnpm --dir functions test:auth       # auth middleware + user-profile logic, mocked
pnpm --dir functions test:resources  # properties/settings/other-charges logic, mocked
```

Run the real-emulator verification scripts (require the Emulator Suite running and a seeded dev user — see [authentication.md](authentication.md)):

```sh
pnpm --dir functions test:auth:emulator
pnpm --dir functions test:resources:emulator
pnpm --dir functions test:assignments:emulator
```

For macOS Java installation, Firebase CLI login, and common Emulator Suite startup problems, see [emulator-troubleshooting.md](emulator-troubleshooting.md).

For ID token verification, user profiles, role middleware, property scope, and Auth Emulator testing, see [authentication.md](authentication.md).
