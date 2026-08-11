# Backend Authentication and Property Scope

## Scope

Phase 3, Step 2 adds Firebase ID-token verification and application-level authorization to the Functions backend. It does not modify React authentication, localStorage, repositories in `src/data`, or any property/room/tenant/billing/invoice APIs.

## Request flow

```text
Request: Authorization: Bearer <Firebase ID token>
  ↓
requireAuth
  ↓
Firebase Admin Auth.verifyIdToken()
  ↓
users/{uid} Firestore profile
  ↓
Role / property-scope guard
  ↓
Controller or route handler
```

`requireAuth` rejects missing or malformed authorization headers with `401 UNAUTHORIZED`. Invalid or expired tokens return `401 INVALID_TOKEN`. It never logs or retains the raw token; after verification it adds a minimal `request.auth`, then the validated application context at `request.user`.

## User profile collection

Application profiles are stored at `users/{uid}`, where `{uid}` is the matching Firebase Authentication UID:

```json
{
  "email": "admin@example.com",
  "displayName": "Administrator",
  "role": "admin",
  "propertyIds": ["property-id"],
  "isActive": true,
  "createdAt": "Firestore Timestamp",
  "updatedAt": "Firestore Timestamp"
}
```

Firebase Authentication owns credentials, password storage, and token issuance. Firestore holds only application authorization data. Profiles are required and must explicitly have `isActive: true`; no request automatically creates a profile.

Supported roles are `admin` and `staff`. `requireRole("admin")` and `requireRole("admin", "staff")` are reusable route middleware. `ensurePropertyAccess(request.user, propertyId)` validates a non-empty property ID and checks membership in `request.user.propertyIds`; future domain routes must call it before using request-supplied property IDs.

## Current-user API

```text
GET /api/v1/auth/me
Authorization: Bearer <Firebase ID token>
```

It returns only the safe application context:

```json
{
  "success": true,
  "data": {
    "id": "firebase-uid",
    "email": "admin@example.com",
    "displayName": "Administrator",
    "role": "admin",
    "propertyIds": ["property-id"]
  }
}
```

No ID token, refresh token, password, or Firebase metadata is returned.

| Situation | HTTP status | Error code |
| --- | --- | --- |
| Missing or malformed bearer token | 401 | `UNAUTHORIZED` |
| Invalid or expired token | 401 | `INVALID_TOKEN` |
| Authenticated UID has no profile | 403 | `USER_PROFILE_NOT_FOUND` |
| Profile is inactive | 403 | `USER_DISABLED` |
| Role not allowed | 403 | `FORBIDDEN` |
| Property not in `propertyIds` | 403 | `PROPERTY_ACCESS_DENIED` |

## Auth Emulator development workflow

The Emulator Suite now starts Functions, Firestore, and Authentication. Install Java first if Firestore Emulator is not available; see [emulator-troubleshooting.md](emulator-troubleshooting.md).

Start emulators with a demo project:

```sh
pnpm --dir functions emulators --project demo-rental-property-management
```

In a second terminal, explicitly seed a development Auth Emulator user and matching Firestore profile. This command is guarded: it fails unless both emulator hosts and a password are provided, so it cannot seed production accidentally.

```sh
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
GCLOUD_PROJECT=demo-rental-property-management \
DEV_USER_PASSWORD='choose-a-local-password' \
pnpm --dir functions seed:dev-user
```

Verify a real token from Auth Emulator against the Functions API:

```sh
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
GCLOUD_PROJECT=demo-rental-property-management \
DEV_USER_PASSWORD='choose-a-local-password' \
pnpm --dir functions test:auth:emulator
```

For a missing profile test, create an Auth Emulator user without running the seed script. For a disabled-user test, set `users/{uid}.isActive` to `false` in Firestore Emulator UI. Never add a development-only authentication bypass to API code.

`pnpm --dir functions test:auth` runs a faster, mocked-dependency version of this logic (no emulator, no network) for quick local iteration — see [backend.md](backend.md).
