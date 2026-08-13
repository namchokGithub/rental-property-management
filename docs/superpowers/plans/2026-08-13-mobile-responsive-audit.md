# Mobile Responsiveness Audit & Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Rooms and Tenants (and Settings' Other Charge Master list) the same table→card mobile pattern Billing and Invoices already have, then visually verify every page of the app at 375/768/1024px and fix whatever else turns up.

**Architecture:** No new dependencies, no new files. Each affected table component (`RoomTable.tsx`, `TenantTable.tsx`, `OtherChargeTable.tsx`) gets a `*Card` sub-component defined in the same file (mirroring `BillingCard` inside `BillingTable.tsx`), and the existing `<Table>` gets wrapped in `hidden ... md:block` while the new card list gets `md:hidden`. Verification is manual/visual (this repo has no test runner — `oxlint` is the only script beyond build/dev) via a throwaway local Firebase Emulator Suite instance + Playwright screenshots, matching the project's own documented "verified via headless Chrome screenshots" convention (`context.md`).

**Tech Stack:** React 19 + TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Firebase Emulator Suite (Auth + Firestore), Playwright (screenshot-only tooling, not added to `package.json` — run via a scratch directory).

## Global Constraints

- Viewports: **375px, 768px, 1024px** only (spec: skip 1440, desktop already confirmed).
- Scope: **Dashboard, Rooms, Tenants, Billing, Invoices, Settings** + the dialogs/forms each opens. `InvoicePrintPage.tsx` (`/invoices/:id`) is **out of scope**.
- Fix every issue found immediately, in the same pass — no per-issue approval gate (spec decision).
- Match the **existing Billing/Invoices table→card pattern exactly** — same breakpoint (`md`), same `Card`/`CardContent` shadcn components, same icon-button action row style. Do not invent a new pattern.
- No changes to: sidebar/header nav drawer, breakpoint values (`sm`/`md`/`lg` stay Tailwind defaults), desktop (`lg`+) layout, the component library choice.
- Every user-facing string goes through `t()` (existing project convention, `context.md`) — reuse existing translation keys already used by each table's desktop columns; do not add new i18n keys unless a task below explicitly says so.
- No automated test suite exists in this repo — do not add one. Verification is the screenshot process below.

---

## Task 1: Local Audit Environment (Emulator + Seed Data + Screenshot Tooling)

**Files:**
- Create (scratch, not committed): a temp `.env.local` (back up any existing one first), a seed script, a screenshot script — all under a scratch directory outside `src/`, e.g. `/tmp/mobile-audit/` (or this session's scratchpad dir if using an agent harness that provides one).
- No `src/` changes in this task.

**Interfaces:**
- Produces: a running app at `http://localhost:5173/#/<route>` logged in as an admin user with 3 seeded rooms, 2 tenants, 1 assignment, 2 billing records, and 1 Other Charge Master row — everything later tasks need to actually see list content (not empty states) when screenshotting.

- [ ] **Step 1: Back up any existing `.env.local`, write a throwaway emulator config**

```bash
cd /Users/socket9companylimited/WorkRoom/rental-property-management
[ -f .env.local ] && cp .env.local /tmp/mobile-audit-env-backup.local || true
cat > .env.local <<'EOF'
VITE_FIREBASE_API_KEY=fake-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-mobile-audit.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-mobile-audit
VITE_FIREBASE_STORAGE_BUCKET=demo-mobile-audit.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
VITE_USE_FIREBASE_EMULATOR=true
EOF
```

`demo-mobile-audit` is a Firebase "demo-*" project ID — the emulator suite treats these as ephemeral/no-billing-required, so no real Firebase project is touched.

- [ ] **Step 2: Start the Firebase emulators (Auth + Firestore) in the background**

```bash
cd /Users/socket9companylimited/WorkRoom/rental-property-management
firebase emulators:start --only auth,firestore --project demo-mobile-audit > /tmp/mobile-audit-emulators.log 2>&1 &
```

Wait until the log shows both emulators listening (poll, don't sleep-guess):

```bash
until grep -q "All emulators ready" /tmp/mobile-audit-emulators.log 2>/dev/null; do sleep 1; done
```

- [ ] **Step 3: Seed the Auth user + Firestore documents**

Create `/tmp/mobile-audit/seed.mjs`:

```js
const PROJECT_ID = "demo-mobile-audit";
const AUTH_BASE = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FIRESTORE_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: toFirestoreFields(value) } };
  throw new Error(`Unsupported value: ${value}`);
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) fields[key] = toFirestoreValue(value);
  return fields;
}

async function writeDoc(path, data) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`Failed to write ${path}: ${res.status} ${await res.text()}`);
}

async function main() {
  const signUp = await fetch(`${AUTH_BASE}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "audit@test.local", password: "AuditPass123!", returnSecureToken: true }),
  });
  const { localId: uid } = await signUp.json();
  console.log("Auth uid:", uid);

  const now = "2026-08-13T00:00:00.000Z";
  const propertyId = "prop-audit";

  await writeDoc(`users/${uid}`, {
    name: "Audit Admin",
    email: "audit@test.local",
    role: "admin",
    propertyIds: [propertyId],
    isActive: true,
  });

  await writeDoc(`properties/${propertyId}`, {
    name: "Audit Test Property",
    address: "123 Audit Street",
    phone: "0800000000",
    createdAt: now,
    updatedAt: now,
  });

  await writeDoc(`properties/${propertyId}/settings/general`, {
    propertyName: "Audit Test Property",
    propertyAddress: "123 Audit Street",
    phone: "0800000000",
    defaultElectricityRate: 7,
    defaultWaterRate: 20,
    defaultInvoiceNote: "Please pay by the due date.",
    otherChargeMasters: [
      {
        id: "charge-parking",
        nameTh: "ค่าที่จอดรถ",
        nameEn: "Parking Fee",
        defaultAmount: 300,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  const rooms = [
    { id: "room-101", roomNumber: "101", floor: "1", type: "Standard", monthlyRent: 4500, status: "occupied", electricityRate: 7, waterRate: 20 },
    { id: "room-102", roomNumber: "102", floor: "1", type: "Standard", monthlyRent: 4500, status: "available", electricityRate: 7, waterRate: 20 },
    { id: "room-201", roomNumber: "201", floor: "2", type: "Deluxe", monthlyRent: 6000, status: "maintenance", electricityRate: 7, waterRate: 20 },
  ];
  for (const room of rooms) {
    const { id, ...data } = room;
    await writeDoc(`properties/${propertyId}/rooms/${id}`, { ...data, description: "", deletedAt: null, createdAt: now, updatedAt: now });
  }

  const tenants = [
    { id: "tenant-1", name: "Somchai Jaidee", phone: "0811111111", status: "active" },
    { id: "tenant-2", name: "Suda Meechai", phone: "0822222222", status: "active" },
  ];
  for (const tenant of tenants) {
    const { id, ...data } = tenant;
    await writeDoc(`properties/${propertyId}/tenants/${id}`, {
      ...data,
      email: "",
      identificationNumber: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      notes: "",
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  await writeDoc(`properties/${propertyId}/assignments/assign-1`, {
    roomId: "room-101",
    tenantId: "tenant-1",
    startDate: now,
    endDate: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  const billingCommon = {
    electricity: { previousMeter: 100, currentMeter: 150, usage: 50, rate: 7, amount: 350 },
    water: { previousMeter: 10, currentMeter: 15, usage: 5, rate: 20, amount: 100 },
    otherCharges: [],
    createdAt: now,
    updatedAt: now,
  };
  await writeDoc(`properties/${propertyId}/billing/room-101_2026-08`, {
    ...billingCommon,
    roomId: "room-101",
    tenantId: "tenant-1",
    invoiceNumber: "INV-2026-08-001",
    billingMonth: "2026-08",
    rentAmount: 4500,
    subtotal: 4950,
    total: 4950,
    status: "issued",
    issuedAt: now,
    dueDate: "2026-08-20T00:00:00.000Z",
    paidAt: null,
    deletedAt: null,
  });
  await writeDoc(`properties/${propertyId}/billing/room-102_2026-08`, {
    ...billingCommon,
    roomId: "room-102",
    tenantId: null,
    invoiceNumber: null,
    billingMonth: "2026-08",
    rentAmount: 4500,
    subtotal: 4950,
    total: 4950,
    status: "draft",
    issuedAt: null,
    dueDate: null,
    paidAt: null,
    deletedAt: null,
  });

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Run it:

```bash
node /tmp/mobile-audit/seed.mjs
```

Expected output: `Auth uid: <some-id>` then `Seed complete.` with no errors.

- [ ] **Step 4: Set up Playwright in a scratch dir (reuses the already-cached Chromium binary)**

```bash
mkdir -p /tmp/mobile-audit/pw && cd /tmp/mobile-audit/pw
npm init -y >/dev/null 2>&1
npm install playwright@1.62.1 >/dev/null 2>&1
```

- [ ] **Step 5: Start the dev server in the background**

```bash
cd /Users/socket9companylimited/WorkRoom/rental-property-management
npm run dev -- --port 5173 > /tmp/mobile-audit-vite.log 2>&1 &
until grep -q "Local:" /tmp/mobile-audit-vite.log 2>/dev/null; do sleep 1; done
```

- [ ] **Step 6: Write the reusable login+screenshot script**

Create `/tmp/mobile-audit/pw/shot.mjs`:

```js
import { chromium } from "playwright";

const [, , route, width, height, outPath] = process.argv;
if (!route || !width || !height || !outPath) {
  console.error("Usage: node shot.mjs <hash-route> <width> <height> <outPath>");
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
  await page.goto("http://localhost:5173/#/dashboard", { waitUntil: "networkidle" });

  const emailInput = page.locator("#login-email");
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill("audit@test.local");
    await page.locator("#login-password").fill("AuditPass123!");
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector("#login-email", { state: "detached", timeout: 10000 });
  }

  await page.goto(`http://localhost:5173/#${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 7: Sanity-check the whole pipeline with one screenshot**

```bash
mkdir -p /tmp/mobile-audit/shots
node /tmp/mobile-audit/pw/shot.mjs /dashboard 375 812 /tmp/mobile-audit/shots/dashboard-375.png
```

Expected: no errors, and the resulting PNG shows the Dashboard (not the login form) — confirms login + emulator + seed data all work end to end. View the file to confirm before moving on.

---

## Task 2: Rooms Page — Mobile Card View

**Files:**
- Modify: `src/features/rooms/RoomTable.tsx` (full current content already read — 121 lines)

**Interfaces:**
- Consumes: `Room` type (`src/types/room.ts`), `StatusBadge` (`src/components/common/StatusBadge.tsx`), existing `RoomTableProps` (unchanged).
- Produces: same public `RoomTable` export/props — no caller (`RoomsPage.tsx`) needs to change.

- [ ] **Step 1: Add the `Card`/`CardContent` import and a `RoomCard` sub-component**

At the top of `src/features/rooms/RoomTable.tsx`, add to the imports:

```tsx
import { Card, CardContent } from "@/components/ui/card";
```

Insert this function above `export function RoomTable`:

```tsx
function RoomCard({
  room,
  tenantName,
  isAdmin,
  onView,
  onEdit,
  onDelete,
  onAssign,
  onEndTenancy,
  t,
  language,
}: {
  room: Room;
  tenantName: string | undefined;
  isAdmin: boolean;
  onView: (room: Room) => void;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
  onAssign: (room: Room) => void;
  onEndTenancy: (room: Room) => void;
  t: (key: string) => string;
  language: Parameters<typeof formatCurrency>[1];
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{room.roomNumber}</p>
          <StatusBadge status={room.status} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <p>
            {t("room.floor")}: {room.floor ?? "—"}
          </p>
          <p>
            {t("room.type")}: {room.type ?? "—"}
          </p>
          <p>
            {t("common.tenant")}: {tenantName ?? t("common.noTenant")}
          </p>
          <p>
            {t("room.monthlyRent")}: {formatCurrency(room.monthlyRent, language)}
          </p>
        </div>
        <div className="flex items-center justify-end gap-1 border-t pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(room)}>
                <Eye className="h-4 w-4" />
                <span className="sr-only">{t("common.view")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.view")}</TooltipContent>
          </Tooltip>
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(room)}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{t("common.edit")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.edit")}</TooltipContent>
            </Tooltip>
          )}
          {isAdmin &&
            (tenantName ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEndTenancy(room)}>
                    <UserMinus className="h-4 w-4" />
                    <span className="sr-only">{t("room.endTenancy")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("room.endTenancy")}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAssign(room)}>
                    <UserPlus className="h-4 w-4" />
                    <span className="sr-only">{t("room.assignTenant")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("room.assignTenant")}</TooltipContent>
              </Tooltip>
            ))}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(room)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t("common.delete")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.delete")}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wrap the existing table and add the mobile card list**

In `export function RoomTable(...)`, change:

```tsx
  return (
    <div className="w-full overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
```

to:

```tsx
  return (
    <>
      <div className="hidden w-full overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
        <Table>
```

and change the closing:

```tsx
      </Table>
    </div>
  );
}
```

to:

```tsx
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            tenantName={tenantNameByRoomId[room.id]}
            isAdmin={isAdmin}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onAssign={onAssign}
            onEndTenancy={onEndTenancy}
            t={t}
            language={language}
          />
        ))}
      </div>
    </>
  );
}
```

(Indent the pre-existing table JSX one level deeper since it's now nested one div deeper — same as `BillingTable.tsx` already does.)

- [ ] **Step 3: Verify with a screenshot**

```bash
node /tmp/mobile-audit/pw/shot.mjs /rooms 375 812 /tmp/mobile-audit/shots/rooms-375-after.png
node /tmp/mobile-audit/pw/shot.mjs /rooms 768 1024 /tmp/mobile-audit/shots/rooms-768-after.png
```

View both files. Expected: at 375px, three cards (room 101/102/201) with no horizontal overflow, status badge visible, action icons tappable (not clipped). At 768px, the original table renders unchanged (sticky-free, simple columns — confirm no regression).

- [ ] **Step 4: Commit**

```bash
git add src/features/rooms/RoomTable.tsx
git commit -m "feat: add mobile card view to Rooms table"
```

---

## Task 3: Tenants Page — Mobile Card View

**Files:**
- Modify: `src/features/tenants/TenantTable.tsx` (full current content already read — 124 lines)

**Interfaces:**
- Consumes: `Tenant` (`src/types/tenant.ts`), `RoomTenantAssignment` (`src/types/assignment.ts`), `Room` (`src/types/room.ts`), `formatDate` (`src/lib/date.ts`).
- Produces: same public `TenantTable` export/props — `TenantsPage.tsx` needs no change.

- [ ] **Step 1: Add the `Card`/`CardContent` import and a `TenantCard` sub-component**

Add to imports:

```tsx
import { Card, CardContent } from "@/components/ui/card";
```

Insert above `export function TenantTable`:

```tsx
function TenantCard({
  tenant,
  room,
  assignment,
  isAdmin,
  onView,
  onEdit,
  onDelete,
  onAssign,
  t,
  language,
}: {
  tenant: Tenant;
  room: Room | undefined;
  assignment: RoomTenantAssignment | undefined;
  isAdmin: boolean;
  onView: (tenant: Tenant) => void;
  onEdit: (tenant: Tenant) => void;
  onDelete: (tenant: Tenant) => void;
  onAssign: (tenant: Tenant) => void;
  t: (key: string) => string;
  language: Parameters<typeof formatDate>[1];
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{tenant.name}</p>
          <StatusBadge status={tenant.status} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <p>
            {t("common.phone")}: {tenant.phone ?? "—"}
          </p>
          <p>
            {t("tenant.currentRoom")}: {room?.roomNumber ?? "—"}
          </p>
          <p>
            {t("room.leaseStart")}: {assignment ? formatDate(assignment.startDate, language) : "—"}
          </p>
          <p>
            {t("room.leaseEnd")}: {assignment?.endDate ? formatDate(assignment.endDate, language) : "—"}
          </p>
        </div>
        <div className="flex items-center justify-end gap-1 border-t pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(tenant)}>
                <Eye className="h-4 w-4" />
                <span className="sr-only">{t("common.view")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.view")}</TooltipContent>
          </Tooltip>
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(tenant)}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{t("common.edit")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.edit")}</TooltipContent>
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAssign(tenant)}>
                  <UserCog className="h-4 w-4" />
                  <span className="sr-only">{room ? t("tenant.moveRoom") : t("tenant.assignRoom")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{room ? t("tenant.moveRoom") : t("tenant.assignRoom")}</TooltipContent>
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(tenant)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t("common.delete")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.delete")}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wrap the existing table and add the mobile card list**

Change:

```tsx
  return (
    <div className="w-full overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
```

to:

```tsx
  return (
    <>
      <div className="hidden w-full overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
        <Table>
```

Change the closing:

```tsx
      </Table>
    </div>
  );
}
```

to:

```tsx
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {tenants.map((tenant) => {
          const assignment = activeAssignmentByTenantId[tenant.id];
          const room = assignment ? roomById[assignment.roomId] : undefined;
          return (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              room={room}
              assignment={assignment}
              isAdmin={isAdmin}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onAssign={onAssign}
              t={t}
              language={language}
            />
          );
        })}
      </div>
    </>
  );
}
```

(Indent the existing table JSX one level deeper, matching `BillingTable.tsx`'s structure.)

- [ ] **Step 3: Verify with a screenshot**

```bash
node /tmp/mobile-audit/pw/shot.mjs /tenants 375 812 /tmp/mobile-audit/shots/tenants-375-after.png
node /tmp/mobile-audit/pw/shot.mjs /tenants 768 1024 /tmp/mobile-audit/shots/tenants-768-after.png
```

View both. Expected: at 375px, two cards (Somchai Jaidee, Suda Meechai) with no overflow; at 768px, unchanged table.

- [ ] **Step 4: Commit**

```bash
git add src/features/tenants/TenantTable.tsx
git commit -m "feat: add mobile card view to Tenants table"
```

---

## Task 4: Settings — Other Charge Master Mobile Card View

**Files:**
- Modify: `src/features/settings/OtherChargeTable.tsx` (full current content already read — 88 lines)

**Interfaces:**
- Consumes: `OtherChargeMaster` (`src/types/otherCharge.ts`).
- Produces: same public `OtherChargeTable` export/props — `OtherChargeSection.tsx` needs no change.

- [ ] **Step 1: Add the `Card`/`CardContent` import and an `OtherChargeCard` sub-component**

Add to imports:

```tsx
import { Card, CardContent } from "@/components/ui/card";
```

Insert above `export function OtherChargeTable`:

```tsx
function OtherChargeCard({
  charge,
  isAdmin,
  onEdit,
  onDelete,
  onToggleActive,
  t,
  language,
}: {
  charge: OtherChargeMaster;
  isAdmin: boolean;
  onEdit: (charge: OtherChargeMaster) => void;
  onDelete: (charge: OtherChargeMaster) => void;
  onToggleActive: (charge: OtherChargeMaster) => void;
  t: (key: string) => string;
  language: Parameters<typeof formatCurrency>[1];
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{language === "en" && charge.nameEn ? charge.nameEn : charge.nameTh}</p>
          <StatusBadge status={charge.isActive ? "active" : "inactive"} />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("settings.otherChargesDefaultAmount")}: {formatCurrency(charge.defaultAmount, language)}
        </p>
        {isAdmin && (
          <div className="flex items-center justify-end gap-1 border-t pt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleActive(charge)}>
                  <Power className="h-4 w-4" />
                  <span className="sr-only">{t("common.status")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{charge.isActive ? t("status.inactive") : t("status.active")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(charge)}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{t("common.edit")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.edit")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(charge)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t("common.delete")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.delete")}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wrap the existing table and add the mobile card list**

Change:

```tsx
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
```

to:

```tsx
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
        <Table>
```

Change the closing:

```tsx
      </Table>
    </div>
  );
}
```

to:

```tsx
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {charges.map((charge) => (
          <OtherChargeCard
            key={charge.id}
            charge={charge}
            isAdmin={isAdmin}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
            t={t}
            language={language}
          />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify with a screenshot**

```bash
node /tmp/mobile-audit/pw/shot.mjs /settings 375 812 /tmp/mobile-audit/shots/settings-375-after.png
```

View it. Expected: the Other Charge Master section shows the "Parking Fee" card, no overflow. (Settings' other sections are single-column already per the earlier research — confirm they still look fine at 375px in this same screenshot.)

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/OtherChargeTable.tsx
git commit -m "feat: add mobile card view to Other Charge Master table"
```

---

## Task 5: Full-App Visual Verification Pass

**Files:**
- Modify: whatever files the audit below turns up (cannot be known in advance — this is the audit itself). Common candidates based on the breakpoint-usage research: `DashboardPage.tsx`, `BillingPage.tsx`, `InvoicesPage.tsx`, `SettingsPage.tsx`, and the dialog components (`RoomFormDialog.tsx`, `TenantFormDialog.tsx`, `BillingFormDialog.tsx`, `RoomImportDialog.tsx`, any `ConfirmDialog` usage).

**Interfaces:** N/A — this task fixes whatever Tasks 2–4 didn't already cover.

- [ ] **Step 1: Screenshot every in-scope page at all three viewports**

```bash
mkdir -p /tmp/mobile-audit/shots/full-pass
for route in dashboard rooms tenants billing invoices settings; do
  for wh in "375 812" "768 1024" "1024 900"; do
    set -- $wh
    node /tmp/mobile-audit/pw/shot.mjs "/$route" "$1" "$2" "/tmp/mobile-audit/shots/full-pass/${route}-${1}.png"
  done
done
```

- [ ] **Step 2: Open at least one dialog per page and screenshot it at 375px**

For each of: Rooms (Add Room), Tenants (Add Tenant), Billing (Create Monthly Billing) — these open a dialog on click. Since `shot.mjs` only screenshots after navigation, extend it for this step with a `--click` variant, or manually drive Playwright for this step:

Create `/tmp/mobile-audit/pw/shot-dialog.mjs` (same login logic as `shot.mjs`, but after navigating to the route, click a button by visible text before screenshotting):

```js
import { chromium } from "playwright";

const [, , route, buttonText, width, height, outPath] = process.argv;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
  await page.goto("http://localhost:5173/#/dashboard", { waitUntil: "networkidle" });
  const emailInput = page.locator("#login-email");
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill("audit@test.local");
    await page.locator("#login-password").fill("AuditPass123!");
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector("#login-email", { state: "detached", timeout: 10000 });
  }
  await page.goto(`http://localhost:5173/#${route}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: buttonText, exact: false }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
}
main().catch((err) => { console.error(err); process.exit(1); });
```

Run:

```bash
node /tmp/mobile-audit/pw/shot-dialog.mjs /rooms "Add Room" 375 812 /tmp/mobile-audit/shots/full-pass/rooms-dialog-375.png
node /tmp/mobile-audit/pw/shot-dialog.mjs /tenants "Add Tenant" 375 812 /tmp/mobile-audit/shots/full-pass/tenants-dialog-375.png
node /tmp/mobile-audit/pw/shot-dialog.mjs /billing "Create Monthly Billing" 375 812 /tmp/mobile-audit/shots/full-pass/billing-dialog-375.png
```

- [ ] **Step 3: Review every screenshot from Steps 1–2**

Check each for: horizontal page scroll (content wider than viewport), text/button clipping or overlap, touch targets that look smaller than ~32px, a dialog that overflows the viewport height with no internal scroll. Note every defect found, with the exact file/route/viewport.

- [ ] **Step 4: Fix each defect found**

Fix directly in the relevant component, using the same Tailwind/shadcn conventions already in the codebase (e.g., if a dialog is too wide at 375px, check how `BillingFormDialog.tsx`/`TenantFormDialog.tsx` already constrain dialog width responsively and mirror that; if a grid doesn't stack, add/adjust `grid-cols-1 sm:grid-cols-*` the same way `DashboardPage.tsx`'s existing grids already do). Since the specific defects aren't known until Step 3 runs, there's no fixed code to pre-write here — apply the minimal Tailwind class change that resolves each specific defect, consistent with the pattern already used elsewhere in the same file or a sibling file.

- [ ] **Step 5: Re-screenshot every page/viewport that was changed in Step 4 to confirm the fix**

Repeat the relevant `shot.mjs`/`shot-dialog.mjs` invocation from Step 1/2 for each changed route+viewport. Confirm the defect is gone and nothing else regressed at the other two viewports for that same page.

- [ ] **Step 6: Commit each fix**

```bash
git add <files changed for this specific defect>
git commit -m "fix: <one-line description of the specific responsive defect fixed>"
```

(One commit per logical fix, not one giant commit — same granularity as Tasks 2–4.)

---

## Task 6: Documentation Update

**Files:**
- Modify: `context.md` (line ~280, the "Responsive" row in the Feature Status table)

**Interfaces:** N/A — docs only.

- [ ] **Step 1: Update the Responsive feature-status row**

Change:

```
| Responsive                    | Done   | Verified at 375/768/1024/1440px via headless Chrome screenshots; sidebar becomes a Sheet drawer under `md`, billing table becomes cards under `md`                                                                                                                                            |
```

to:

```
| Responsive                    | Done   | Verified at 375/768/1024px via headless Chrome screenshots across all 6 pages; sidebar becomes a Sheet drawer under `md`; Billing, Invoices, Rooms, Tenants tables and the Other Charge Master list become cards under `md`                                                                     |
```

(Adjust the exact wording if Task 5 found and fixed anything else worth calling out — e.g. a specific dialog width fix — but keep it to one line, matching the existing table's terseness.)

- [ ] **Step 2: Commit**

```bash
git add context.md
git commit -m "docs: update Responsive feature status after mobile audit"
```

---

## Cleanup (after all tasks)

- [ ] Stop the background dev server, emulators; restore the original `.env.local` if one was backed up in Task 1 Step 1:

```bash
[ -f /tmp/mobile-audit-env-backup.local ] && cp /tmp/mobile-audit-env-backup.local /Users/socket9companylimited/WorkRoom/rental-property-management/.env.local || rm -f /Users/socket9companylimited/WorkRoom/rental-property-management/.env.local
```
