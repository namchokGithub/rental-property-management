# Firebase Client Setup

## Scope

Phase 2 adds the modular Firebase JavaScript client infrastructure only. It does not change the demo authentication flow, repository implementations, localStorage data, or application CRUD behavior. Future code must import Firebase clients from `@/lib/firebase`, never directly from `firebase/*` in React components.

## Firebase Console setup

1. Create or select a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Add a **Web** app to that project and register it. Copy the Web app configuration values; these are public client identifiers, but should still be maintained through environment files rather than source code.
3. In **Build → Firestore Database**, create a Firestore database. Select the location deliberately: it cannot be changed later and should be close to the application and expected users. This phase does not deploy rules, indexes, or records.
4. In **Build → Authentication**, enable the providers needed by the future product (for example, Email/Password). Do not change the app's current demo authentication service yet.
5. If callable APIs will be used later, enable and configure Cloud Functions in the project. The client has no callable-function invocations in this phase.

## Development environment

Copy the example file and fill it with the Firebase Web app configuration for your development project:

```sh
cp .env.example .env.local
```

Required values:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Optional values:

```dotenv
# Defaults to us-central1
VITE_FIREBASE_FUNCTIONS_REGION=

# Set to true only for local development with the Emulator Suite running.
VITE_USE_FIREBASE_EMULATOR=false
```

Vite exposes only variables prefixed with `VITE_` to the browser. Do not commit `.env.local` or production-specific values. Restart the Vite dev server after changing environment variables.

The configuration is validated when the Firebase infrastructure is first imported. An incomplete configuration produces an explicit error naming the missing variable names, without logging their values. The active app does not import this infrastructure yet, so it continues to run with localStorage before Firebase configuration exists.

## Client infrastructure

```text
src/lib/firebase/
  config.ts       validated Vite configuration and emulator switch
  app.ts          singleton Firebase App
  auth.ts         Firebase Authentication instance
  firestore.ts    Cloud Firestore instance
  functions.ts    Cloud Functions client with configured/default region
  emulators.ts    central, development-only Emulator Suite wiring
  index.ts        public client boundary and non-I/O smoke check
```

Use the public boundary in later services and repository adapters:

```ts
import { auth, db, functions } from "@/lib/firebase";
```

`assertFirebaseClientInitialized()` is a lightweight non-UI smoke check. It validates that the App, Auth, Firestore, and Functions client instances initialized; it does not sign in, read or write Firestore data, or call a function.

## Emulator Suite

Install the Firebase CLI separately if it is not already available, then initialize and run the emulators for the project when that work is planned:

```sh
firebase init emulators
firebase emulators:start
```

With the default Emulator Suite ports, add this to `.env.local` before starting Vite:

```dotenv
VITE_USE_FIREBASE_EMULATOR=true
```

When both `import.meta.env.DEV` and this setting are true, the central client boundary connects:

- Authentication to `http://127.0.0.1:9099`
- Firestore to `127.0.0.1:8080`
- Functions to `127.0.0.1:5001`

The emulator switch is ignored in production builds. A global connection marker prevents duplicate emulator connections during Vite hot-module replacement. Do not turn it on against a production build.

## Verification and next phase

Run `pnpm build` after changing the infrastructure. No Firebase connection test should create records; client initialization is enough for this phase. The next authorized phase can implement Firebase Authentication through the existing `AuthProvider` boundary or replace repository internals with API/Firestore adapters while preserving the data model in [data-model.md](data-model.md).
