# Design: Import Rooms via Excel

Date: 2026-08-12
Status: Approved by user, ready for implementation planning

## Problem

Rooms can currently only be created one at a time via `RoomFormDialog`. A property owner onboarding a building with many rooms (e.g. 20-100 units) has to fill the same form repeatedly. The Rooms page (`src/features/rooms/RoomsPage.tsx`) needs a bulk-create path that lets an admin upload a spreadsheet of rooms and have them validated and created in one action.

## Current State (verified against the code, 2026-08-12)

- `src/types/room.ts` — `Room { id, roomNumber, floor?, type?, monthlyRent, status, description?, createdAt, updatedAt }`. `CreateRoomInput = Omit<Room, "id"|"createdAt"|"updatedAt"|"status"> & { status?: RoomStatus }`. `RoomStatus = "available" | "occupied" | "maintenance" | "inactive"`.
- `src/lib/validation.ts` — `validateRoom(input)` checks only: `roomNumber` required (non-blank) -> `validation.room.roomNumberRequired`; `monthlyRent < 0` -> `validation.room.monthlyRentNegative` (only checked when defined; `0` passes; blank/`NaN` is not currently checked because the form always supplies a coerced number).
- `src/hooks/useRooms.ts` — `{ rooms, isLoading, createRoom, updateRoom, deleteRoom }`. `createRoom(input)` calls `roomRepository.create(propertyId, input)`, one `addDoc` per call. No batch/bulk-create exists anywhere in the repo (no `writeBatch` usage in any repository).
- `src/features/rooms/RoomFormDialog.tsx` — single-room form; on submit builds `CreateRoomInput` by trimming strings and `Number(form.monthlyRent) || 0`, runs `validateRoom`, shows field errors inline via `t(errors.field)`.
- `src/features/rooms/RoomsPage.tsx` — admin-gated "+ Add Room" button opens `RoomFormDialog`. Data comes from `useRooms()`, already loaded client-side and kept live via `onSnapshot`.
- No Excel/CSV library is installed (`package.json` has none of `xlsx`/`exceljs`/`papaparse`; confirmed by grep). No import/export feature exists anywhere in the codebase.
- Closest existing precedent for "operate on many rows, collect per-row success/failure" is Billing's bulk-issue (`BillingPage.tsx`), which loops `updateBilling()` **sequentially** because invoice numbering has an ordering dependency. Room creation has no such dependency between rows.
- Dialog conventions: `src/components/ui/dialog.tsx` (`DialogContent`, `DialogHeader`, `DialogFooter`). No wizard/step-based dialog exists yet; `BillingFormDialog.tsx` is the largest form dialog and uses one scrollable `DialogContent` with `Separator`-divided sections rather than steps.

## Decisions

- **Scope: create-only, not upsert.** Every row in the file becomes a new room. A row whose `roomNumber` collides with an existing room (or another row in the same file) is a per-row validation error, not an update. Simpler, matches "bulk-create for onboarding" as the actual use case.
- **Library: `exceljs`.** Needs both read (parse uploaded `.xlsx`) and write (generate the downloadable template) capability. The alternative, `xlsx` (SheetJS), has its actively-maintained builds distributed only via SheetJS's own CDN rather than npm — the npm-published version is old and carries a known prototype-pollution advisory. `exceljs` is npm-native and actively maintained.
- **Preview-then-confirm, not import-on-upload.** Parsed rows are shown in an editable-visibility table (checkbox per row, invalid rows auto-excluded) with inline errors before anything is written to Firestore, so a bad file doesn't create N-1 good rooms and 1 confusing failure with no chance to fix it first.
- **Parallel writes, not sequential.** Unlike Billing's sequential bulk-issue (which must serialize because of shared invoice-number generation), room creation has no cross-row ordering dependency, so import uses `Promise.allSettled` over `createRoom()` calls concurrently.
- **No repository/hook changes.** Reuses `createRoom` from `useRooms()` in a loop; no new `writeBatch`-based bulk-create method, matching the fact that no batch-write path exists anywhere else in this codebase yet and expected import volume (tens of rooms) doesn't need one.
- **Column headers: fixed English names, case-insensitive.** `roomNumber, floor, type, monthlyRent, status, description`. No localized header support in v1 — the downloadable template is the canonical source of correct headers.

## New Files

- `src/lib/excel.ts`
  - `downloadRoomImportTemplate(): Promise<void>` — builds a workbook via `exceljs` in-memory (header row + one example row: `A101, 1, Standard, 1500, available, ""`), triggers a browser download (`Blob` + temporary `<a>` click), filename `room-import-template.xlsx`.
  - `parseRoomImportFile(file: File): Promise<ParsedRoomRow[]>` — loads the workbook via `exceljs`, reads the first worksheet, maps the header row (case-insensitive match against the 6 known column names) to a field index, then returns one `ParsedRoomRow` per data row: `{ rowNumber: number; roomNumber: string; floor: string; type: string; monthlyRent: string; status: string; description: string }` (all raw strings/blank — coercion happens where `RoomFormDialog` already does it, in the preview step, not here). Throws a typed `MissingColumnsError` if required headers (`roomNumber`, `monthlyRent`) aren't found at all, so the dialog can show one clear message instead of 100 per-row errors.

- `src/features/rooms/RoomImportDialog.tsx`
  - Local `step: "upload" | "preview" | "result"` state, mirroring the single-`DialogContent`-with-conditional-sections convention already used by `BillingFormDialog` rather than introducing a new wizard component.
  - **Upload step:** file input accepting `.xlsx`; "Download Template" button calling `downloadRoomImportTemplate()`; short column-reference text. On file selection, calls `parseRoomImportFile`, builds preview rows, moves to `preview` step. A thrown `MissingColumnsError` shows an inline error and stays on the upload step.
  - **Preview step:** table, one row per parsed record showing `roomNumber, floor, type, monthlyRent, status, description`, plus a status column (valid / error text) and an include checkbox (checked + enabled only when valid). Each row's `CreateRoomInput` is built with the same trim/`Number(...) || 0`-style coercion as `RoomFormDialog`, then validated by:
    1. `validateRoom(input)` (reused unchanged),
    2. a new check: blank/non-numeric `monthlyRent` -> `validation.room.monthlyRentRequired` (distinct from the existing negative-only check, since a required field left blank in a spreadsheet is a real, common mistake `validateRoom` doesn't currently catch),
    3. a new check: `roomNumber` already exists in `rooms` (from `useRooms()`) or appears earlier in this same parsed file -> `validation.room.roomNumberDuplicate`.
    4. `status`, if non-blank, must case-insensitively match one of the four `RoomStatus` values -> `validation.room.invalidStatus`; blank defaults to `"available"`.
    Summary line above the table: "`{{valid}} valid, {{invalid}} invalid`" (new key `room.importSummary`). Confirm button ("`Import {{count}} Rooms`", new key `room.importConfirm`) is disabled when the checked-row count is 0.
  - **Result step:** after `Promise.allSettled` resolves, shows counts of created vs. failed rows; failed rows (expected to be rare — e.g. a same-second race on `roomNumber` uniqueness) list their `roomNumber` and error. A "Close" button dismisses the dialog; the Rooms table updates on its own via the existing `onSnapshot` subscription in `useRooms()`.

## Changed Files

- `src/features/rooms/RoomsPage.tsx` — add an admin-gated "Import" button (outline variant) next to the existing "+ Add Room" button, opening `RoomImportDialog`.
- `src/lib/validation.ts` — no change to `validateRoom` itself; the 3 new checks above live in `RoomImportDialog`'s row-processing code, not in the shared validator, because they only make sense in the "many rows against each other and against existing data" import context, not for the single-room form.
- `src/i18n/types.ts` / `src/i18n/translations/en.ts` / `src/i18n/translations/th.ts` — add under `room.*`: `importRooms, importDescription, downloadTemplate, uploadFile, importSummary, importConfirm, importSuccessToast, missingColumnsError`, worded to match the existing tone of each dictionary (English strings are plain imperative/label style, Thai strings match the polite register already used across `room.*`, e.g. `deleteConfirmTitle`). Add under `validation.room.*`: `monthlyRentRequired, roomNumberDuplicate, invalidStatus`.
- `package.json` — add `exceljs` as a dependency.

## Error Handling

- File-level: wrong file type, unreadable file, or missing required columns -> one clear message on the upload step, no partial preview shown.
- Row-level: shown inline in the preview table per the 4 checks above; invalid rows never reach the write step (checkbox stays unchecked/disabled).
- Write-level: a `createRoom()` promise rejecting during the confirm step (rare race) is caught per-row via `Promise.allSettled` and reported in the result step; it does not abort the other in-flight writes.

## Out of Scope (v1)

- Update/upsert of existing rooms via import.
- Localized (Thai) column headers in the uploaded file.
- CSV support (xlsx only).
- Any Firestore-side batch-write mechanism — writes remain one `addDoc` per room, same as manual creation.

## Verification

No automated test suite exists in this repo (see `context.md` Known Limitations). Verify manually against the Firebase Emulator Suite:

1. Download the template, fill 3-5 rows, upload -> all show valid, import succeeds, rooms appear in the table.
2. Upload a file with one row missing `roomNumber` and one row with a negative `monthlyRent` -> both flagged invalid, excluded from the default selection, remaining valid rows still import.
3. Upload a file with a `roomNumber` that already exists -> flagged as duplicate.
4. Upload a file with two rows sharing the same `roomNumber` -> second occurrence flagged as duplicate.
5. Toggle language (Thai/English) while the dialog is open at each step -> all copy translates.
6. Confirm a `staff`-role user does not see the "Import" button (same admin-gate as "+ Add Room").
