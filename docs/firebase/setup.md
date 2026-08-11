# Firebase Client Setup

## Scope

This describes the Firebase client infrastructure the app actually uses: `firebase/auth` and `firebase/firestore`, both accessed only through `@/lib/firebase` — no `firebase-admin`, no Cloud Functions, no REST layer. There is no backend; every read/write in the app goes straight from the browser to Firebase, with [firestore.rules](../../firestore.rules) as the sole authorization boundary. Never import `firebase/*` directly in a React component, repository, or hook — always import `auth`/`db` from `@/lib/firebase`.

## Firebase Console setup

1. Create or select a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Add a **Web** app to that project and register it. Copy the Web app configuration values — these are public client identifiers, but should still be kept in environment files rather than source code.
3. In **Build → Firestore Database**, create a Firestore database. Select the location deliberately — it cannot be changed later.
4. In **Build → Authentication**, enable **Email/Password** as a sign-in provider (the only one the app uses today).
5. Deploy [firestore.rules](../../firestore.rules) and [firestore.indexes.json](../../firestore.indexes.json) to the project:

   ```sh
   firebase deploy --only firestore:rules,firestore:indexes --project <your-project-id>
   ```

6. Bootstrap the first property and admin user by hand — see the README's [First-Time Setup](../../README.md#first-time-setup). There is no sign-up flow and no script that can safely do this (Firestore rules forbid a user from writing their own profile/role).

## Development environment

Copy the example file and fill it with your Firebase Web app configuration:

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

Optional:

```dotenv
# Set to true only for local development with the Emulator Suite running (see below).
VITE_USE_FIREBASE_EMULATOR=false
```

Vite exposes only variables prefixed with `VITE_` to the browser. Do not commit `.env.local`. Restart the Vite dev server after changing environment variables.

Configuration is validated the first time `@/lib/firebase` is imported (`getFirebaseConfig()` in `src/lib/firebase/config.ts`); an incomplete configuration throws an explicit error naming the missing variables, without logging their values.

## Client infrastructure

```text
src/lib/firebase/
  config.ts       validated Vite configuration and the emulator switch
  app.ts          singleton Firebase App
  auth.ts         Firebase Authentication instance
  firestore.ts    Cloud Firestore instance
  emulators.ts    development-only Emulator Suite wiring (Auth + Firestore)
  index.ts        public client boundary
```

```ts
import { auth, db } from "@/lib/firebase";
```

## Emulator Suite

Install the Firebase CLI if it isn't already available, then run the Auth and Firestore emulators from the repo root ([firebase.json](../../firebase.json) already configures ports — Firestore `8080`, Auth `9099`, Emulator UI `4001`):

```sh
firebase emulators:start --only auth,firestore
```

With the emulators running, add this to `.env.local` before starting Vite:

```dotenv
VITE_USE_FIREBASE_EMULATOR=true
```

When both `import.meta.env.DEV` and this setting are true, `connectFirebaseEmulators()` (`src/lib/firebase/emulators.ts`) connects:

- Authentication to `http://127.0.0.1:9099`
- Firestore to `127.0.0.1:8080`

The emulator switch is ignored in production builds. A global connection marker prevents duplicate emulator connections during Vite hot-module replacement.

Bootstrap a property/admin user against the emulators exactly the same way as a real project (README's [First-Time Setup](../../README.md#first-time-setup)), using the Emulator UI (`http://127.0.0.1:4001`) instead of the Firebase Console — create the Auth user under **Authentication**, then hand-write `properties/{propertyId}`, `properties/{propertyId}/settings/general`, and `users/{uid}` under **Firestore**. If Java isn't installed and the Firestore emulator won't start, see [emulator-troubleshooting.md](emulator-troubleshooting.md).

## Verification

```sh
pnpm build
pnpm lint
```

Then a manual smoke test against the running emulators: `pnpm dev`, sign in with the bootstrapped admin user, and walk through the pages that matter for whatever you changed. See [context.md](../../context.md) for the full architecture and business rules, and [data-model.md](data-model.md) for the Firestore schema.
