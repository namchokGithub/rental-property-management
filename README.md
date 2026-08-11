# Rental Property Management

A responsive frontend web application for managing rental rooms, apartments, or dormitory rooms: rooms, tenants, tenant-room assignments, monthly utility/rent billing, invoice generation, and a dashboard overview.

The app talks directly to Firebase — Firebase Authentication for login and Cloud Firestore for every business record — with no backend server of any kind. It is deployed as a static site (see [Build](#build) below); Firestore Security Rules are the sole authorization boundary.

## Requirements

- Node.js 20+
- pnpm
- A Firebase project (or the local Firebase Emulator Suite for development — see [Firebase Setup](docs/firebase/setup.md))

## Installation

```bash
pnpm install
```

## Development

```bash
cp .env.example .env.local   # fill in your Firebase Web app config — see docs/firebase/setup.md
pnpm dev
```

Opens the app at `http://localhost:5173`. There is no seed data — see [First-Time Setup](#first-time-setup) below to bootstrap a property and an admin user before the app has anything to show.

## Build

```bash
pnpm build
```

Type-checks with `tsc -b` and produces a static production build in `dist/`, ready to deploy to any static host (e.g. GitHub Pages — `vite.config.ts` sets `base: "/rental-property-management/"` for that target).

## Lint

```bash
pnpm lint
```

## Main Features

- **Authentication** — Firebase Authentication gates the whole app; a Firestore `users/{uid}` profile carries the role (`admin`/`staff`) and property access (see [Authentication](#authentication) below).
- **Dashboard** — occupancy summary cards, room status breakdown, recent billing, quick actions.
- **Rooms** — CRUD (admin only), status (available/occupied/maintenance/inactive), room detail with utility rates and billing history.
- **Tenants** — CRUD (admin only), contact/emergency/lease info, current room lookup.
- **Assignments** — assign a tenant to a room, end a tenancy, move a tenant to a different room (admin only). Only one active assignment per room at a time; room status updates automatically.
- **Monthly Billing** — enter electricity/water meter readings and fees; usage and totals are calculated automatically. Wide table with sticky Room/Tenant columns on desktop, card layout on mobile. Issuing, marking paid, and bulk-issuing are admin only.
- **Invoices** — auto-numbered (`INV-YYYY-MM-###`) invoice list, in-app preview, and a standalone printable bilingual invoice document (browser print / Save as PDF, A4-optimized).
- **Settings** — property information, the default electricity/water rates and invoice note, plus an optional Other Charge Master list (e.g. parking or garbage fees) that users explicitly add to individual bills. Editing is admin only.
- **Search** — every list page (Rooms, Tenants, Billing, Invoices) has a client-side search box that filters the loaded records instantly.
- **Localization** — switch between Thai and English instantly, anywhere in the app (see below).
- **Appearance & themes** — light, dark, and system appearance modes with four persisted accent themes: Sky Purple, Ocean, Emerald, and Rose.

## Tech Stack

- Vite + React + TypeScript (strict mode)
- Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`)
- Radix UI primitives (via the `radix-ui` package), styled in the shadcn/ui convention
- React Router
- lucide-react icons
- sonner (toast notifications)
- Firebase JS SDK (`firebase/auth`, `firebase/firestore`) — no `firebase-admin`, no Cloud Functions, no REST layer
- Custom lightweight i18n (no library) — see Localization below

## Project Structure

```
src/
  app/            # router, layout shell
  auth/           # Firebase-backed authentication service and React auth context
  components/     # ui primitives, layout, shared common components
  data/           # Firestore repositories (rooms, tenants, assignments, billing, settings, other charges)
  features/       # one folder per page/feature
  hooks/          # thin reactive hooks (onSnapshot-driven) wrapping repositories
  i18n/           # typed Thai/English dictionaries and language context
  lib/            # pure calculation/formatting/validation utilities, Firebase client boundary
  theme/          # appearance/accent theme context and persistence
  types/          # domain models
docs/firebase/    # Firebase project setup and Firestore data-model documentation
firestore.rules            # the only authorization boundary — see docs/firebase/data-model.md
firestore.indexes.json     # composite indexes required by the two transactional queries
```

See [context.md](context.md) for the full architecture, domain model, business rules, and continuation notes for future development.

## Authentication

The app is gated behind a login screen backed by real Firebase Authentication. There is no backend server: `AuthContext` subscribes to Firebase's `onAuthStateChanged()` and, on every signed-in transition, reads the user's application profile directly from Firestore at `users/{uid}` (`role`, `propertyIds`, `isActive`, `name`, `email`). A missing or inactive profile is treated as "not authorized" — the user stays on the login screen even though their Firebase credential is valid.

`role: "admin"` may create/edit/delete every business record; `role: "staff"` may only read. The UI hides write affordances (Add/Edit/Delete/Issue/Mark Paid/etc.) for `staff` users, but that is a UX convenience only — the actual enforcement is [Firestore Security Rules](firestore.rules), since there is no server to trust. A `staff` user who somehow triggers a write anyway (e.g. via devtools) gets a rejected Firestore write, not a security hole.

The UI only ever talks to an `AuthProvider` interface (`src/auth/auth.types.ts`) through `useAuth()` — see [context.md](context.md#authentication) for the full architecture.

### First-Time Setup

There is no sign-up flow and, since there's no backend, no server-side script that can safely create a `users/{uid}` profile (Firestore rules deliberately forbid a user from writing their own profile/role — otherwise anyone could grant themselves `admin`). The very first property and admin user must be created by hand, once, via the [Firebase Console](https://console.firebase.google.com/) (or the Emulator UI for local development — see [Firebase Setup](docs/firebase/setup.md#emulator-suite)):

1. **Authentication → Users → Add user.** Create the admin's email/password account. Note the generated UID.
2. **Firestore Database → Start collection.** Create the document `properties/{propertyId}/settings/general` (pick any ID for `propertyId`, e.g. `demo-property`; Firestore lets you create a nested document path directly without first creating the parent `properties/{propertyId}` document itself) with fields `propertyName` (string), `propertyAddress` (string), `phone` (string), `defaultElectricityRate` (number), `defaultWaterRate` (number), `defaultInvoiceNote` (string). `otherChargeMasters` can be left unset — the app treats a missing array as empty.
3. Create `users/{uid}` (document ID = the Auth UID from step 1) with fields `name` (string), `email` (string, matching the Auth account), `role` (string, `"admin"`), `propertyIds` (array of strings, e.g. `["demo-property"]`), `isActive` (boolean, `true`).
4. Sign in with that email/password. You should land on the Dashboard with the property from step 2 selected automatically (the UI is single-property today — it always uses the first entry in `propertyIds`).

To create a `staff` user later, repeat steps 1 and 3 with `role: "staff"` — no new property/settings documents are needed, just add the same `propertyId` to their `propertyIds` array. A `staff` user can read everything but never sees create/edit/delete buttons, and any write they attempt directly against Firestore is rejected by [firestore.rules](firestore.rules).

## Localization

**Supported Languages**

- Thai (default)
- English

Switch languages instantly from the two buttons in the top header ("ไทย" / "EN") — no page reload. The choice is saved to `localStorage` (`app.language`) and restored on the next visit. Every screen, form, dialog, table, toast, and the printable invoice document itself are all fully translated; only property-owner-entered data (property name/address, invoice notes, room/tenant names) is left as-is, since that's real content rather than UI copy.

**How to add more languages**

The system was built to make this a translation-file-only change:

1. Add the new language code to the `Language` union in `src/i18n/types.ts`.
2. Add `src/i18n/translations/<code>.ts` exporting a dictionary typed `: Translations` — TypeScript will flag any missing key at compile time, so an incomplete translation can't ship.
3. Register the new dictionary in `src/i18n/index.ts`'s `DICTIONARIES` map.
4. Add a corresponding button/option to `src/components/common/LanguageSwitch.tsx` (shared by the header and the login page).

No other component needs to change. See [context.md](context.md) for the full localization architecture.

## Appearance and Accent Themes

Choose light, dark, or system appearance and one of four accent themes from the header menu. Both settings apply immediately and persist across visits using `app.appearance` and `app.accentTheme`. The saved theme is applied before React mounts to avoid a flash of the default theme.

## Firebase Setup

See [docs/firebase/setup.md](docs/firebase/setup.md) for Firebase Console project setup, `.env.local` configuration, and running the Auth + Firestore Emulator Suite locally:

```bash
firebase emulators:start --only auth,firestore
```

with `VITE_USE_FIREBASE_EMULATOR=true` in `.env.local` so the running `pnpm dev` instance connects to the emulators instead of a real project. See [docs/firebase/data-model.md](docs/firebase/data-model.md) for the full Firestore schema and [firestore.rules](firestore.rules) for the security rules.

## Current Limitations

- Single property only (no multi-property switcher in the UI — the schema supports multiple properties per user via `users/{uid}.propertyIds`, but the app always uses the first one).
- No real PDF generation service — invoice export relies on the browser's native print / "Save as PDF".
- No automated recurring billing generation or notifications.
- No automated test suite — verification is `pnpm build` (typecheck + production build), `pnpm lint`, and manual smoke testing against the Firebase Emulator Suite.
- Firestore Security Rules enforce property/role boundaries but cannot cheaply enforce every cross-document business invariant (e.g. "at most one active assignment per room") the way a transactional client call does — a malicious `admin`-role account bypassing the app's own repository code via the raw SDK is a known, accepted trade-off of having no backend. See [context.md](context.md#known-limitations).
