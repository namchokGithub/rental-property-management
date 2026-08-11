# Firebase Functions Backend Foundation

## Scope

Phase 3 adds the backend foundation and authentication/property-scope infrastructure. It does not connect the React app, replace localStorage repositories, migrate data, or implement domain CRUD APIs.

## Architecture

```text
HTTP API
  ↓
Express
  ↓
Cloud Functions (2nd gen)
  ↓
Firebase Admin SDK
  ↓
Firestore
```

The planned domain flow inside this boundary is `Route → Controller → Service → Repository → Firebase Admin SDK`. User-profile repository/service and authentication middleware are now implemented; domain controllers, services, repositories, and CRUD routes remain future work.

## Folder structure

```text
functions/
  .env.example
  package.json
  src/
    app.js                    Express composition root
    index.js                  2nd gen HTTPS Cloud Function export
    config/
      firebase.js             singleton Firebase Admin App, Firestore, Auth
      cors.js                 configurable CORS middleware
    errors/app-error.js       reusable HTTP application error
    middleware/error.middleware.js
    routes/health.routes.js
    utils/response.js         standardized success/list/error responses
    smoke-test.js             local, no-data verification script
```

`functions/src/config/firebase.js` initializes the Admin App once with `getApps()`/`getApp()` and exports `db` and `auth`. Routes must not initialize Firebase Admin themselves. The Admin SDK observes emulator environment variables supplied by the Firebase CLI; no frontend Firebase SDK or `VITE_*` configuration is used by the backend.

## API

The single 2nd gen HTTP function is `api`. Future endpoints live below `/api/v1`; the sole current endpoint is public:

```text
GET /api/v1/health
```

It returns:

```json
{
  "success": true,
  "data": { "status": "ok" }
}
```

Unknown routes return a JSON `404 NOT_FOUND` response. The centralized error middleware returns standardized errors and logs only minimal server-side diagnostic metadata for unexpected errors; it never sends stack traces or Firebase internals to callers.

## Local emulator

Install backend dependencies once:

```sh
pnpm --dir functions install
```

Copy `functions/.env.example` to an ignored local environment file if a non-default region or explicit CORS origins are needed. `FUNCTIONS_REGION` defaults to `asia-southeast1`; it must match the frontend Functions region when the frontend is integrated later. `CORS_ALLOWED_ORIGINS` is a comma-separated allow-list; leave it empty only for local development and configure it before production.

Start Functions, Firestore, and Authentication Emulator Suite:

```sh
pnpm --dir functions emulators --project demo-rental-property-management
```

The configured ports are Functions `5001`, Firestore `8080`, Authentication `9099`, and Emulator UI `4001`. A Firebase project alias is intentionally not committed because the repository has no assigned Firebase project yet. Replace the demo project ID with the chosen Firebase project when appropriate.

Run the no-data smoke verification:

```sh
pnpm --dir functions test:smoke
```

It verifies Firebase Admin App/Auth/Firestore object creation, the Express app, `GET /api/v1/health`, and standardized JSON 404 handling. It makes no Firestore read or write.

For macOS Java installation, Firebase CLI login, and common Emulator Suite startup problems, see [emulator-troubleshooting.md](emulator-troubleshooting.md).

For ID token verification, user profiles, role middleware, property scope, and Auth Emulator testing, see [authentication.md](authentication.md).
