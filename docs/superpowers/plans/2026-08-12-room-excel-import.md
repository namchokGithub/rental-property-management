# Import Rooms via Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin upload an `.xlsx` file on the Rooms page to create many rooms at once, with a validated preview step before anything is written to Firestore.

**Architecture:** A new `src/lib/excel.ts` module parses an uploaded workbook into raw row data and generates a downloadable template using `exceljs`. A new pure function module (`roomImportValidation.ts`) turns those raw rows into `CreateRoomInput`s and runs validation (reusing `validateRoom` plus three new import-specific checks). A new `RoomImportDialog` component drives a 3-step (`upload` -> `preview` -> `result`) UI on top of those two modules, writing valid rows via the existing `useRooms().createRoom` in parallel. `RoomsPage` gets one new admin-gated button to open it.

**Tech Stack:** React 19 + TypeScript strict, `exceljs` (new dependency) for `.xlsx` read/write, existing `src/components/ui/*` primitives (Dialog, Table, Checkbox, Button), existing `useRooms()`/`useLanguage()` hooks.

**Full design reference:** [docs/superpowers/specs/2026-08-12-room-excel-import-design.md](../specs/2026-08-12-room-excel-import-design.md)

## Global Constraints

- Preserve TypeScript strict mode; do not introduce `any` (project-wide rule, `context.md`).
- Never call `firebase/*` or a repository directly from a component/hook — bulk writes go through `useRooms().createRoom`, one call per row, exactly like the existing single-room form (`context.md` Repository architecture).
- Never hardcode user-facing strings — every new string is a key added to `Translations` (`src/i18n/types.ts`) and both `src/i18n/translations/en.ts` and `th.ts` in the same task (`context.md` Development Guidelines).
- This repo has no automated test suite (no `vitest`/`jest`). Each task's "Verify" step is `pnpm build` (runs `tsc -b` then `vite build` — this is the project's typecheck) and `pnpm lint` (`oxlint`), plus manual browser verification where the task note says so.
- **Do NOT run `git commit` for any step in this plan.** The user commits changes themselves. Each task ends with "stop for review," not a commit.
- Import is create-only (no upsert), `.xlsx` only, fixed column headers `roomNumber, floor, type, monthlyRent, status, description` matched case-insensitively.

---

### Task 1: `src/lib/excel.ts` — parse uploaded file + generate template

**Files:**
- Modify: `package.json` (add `exceljs` dependency)
- Modify: `vite.config.ts` (only if the browser-compat check in Step 4 fails)
- Create: `src/lib/excel.ts`

**Interfaces:**
- Produces:
  - `interface ParsedRoomRow { rowNumber: number; roomNumber: string; floor: string; type: string; monthlyRent: string; status: string; description: string }`
  - `class MissingColumnsError extends Error { missing: string[] }`
  - `parseRoomImportFile(file: File): Promise<ParsedRoomRow[]>`
  - `downloadRoomImportTemplate(): Promise<void>`

- [ ] **Step 1: Add the `exceljs` dependency**

Run: `pnpm add exceljs`

This updates `package.json`/`pnpm-lock.yaml` directly — no manual edit needed.

- [ ] **Step 2: Write `src/lib/excel.ts`**

```ts
import ExcelJS from "exceljs";

export interface ParsedRoomRow {
  rowNumber: number;
  roomNumber: string;
  floor: string;
  type: string;
  monthlyRent: string;
  status: string;
  description: string;
}

export class MissingColumnsError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Missing required columns: ${missing.join(", ")}`);
    this.name = "MissingColumnsError";
    this.missing = missing;
  }
}

const COLUMNS = ["roomNumber", "floor", "type", "monthlyRent", "status", "description"] as const;
type ColumnName = (typeof COLUMNS)[number];
const REQUIRED_COLUMNS: ColumnName[] = ["roomNumber", "monthlyRent"];

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("error" in value) return "";
    if ("richText" in value) {
      return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join("");
    }
    if ("text" in value) return String((value as { text: unknown }).text ?? "");
    if ("result" in value) return cellText((value as { result: unknown }).result);
  }
  return String(value).trim();
}

export async function parseRoomImportFile(file: File): Promise<ParsedRoomRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const columnIndexByName = new Map<ColumnName, number>();
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cellText(cell.value).toLowerCase();
    const match = COLUMNS.find((name) => name.toLowerCase() === header);
    if (match) columnIndexByName.set(match, colNumber);
  });

  const missing = REQUIRED_COLUMNS.filter((name) => !columnIndexByName.has(name));
  if (missing.length > 0) throw new MissingColumnsError(missing);

  const rows: ParsedRoomRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const get = (name: ColumnName): string => {
      const colNumber = columnIndexByName.get(name);
      return colNumber ? cellText(row.getCell(colNumber).value) : "";
    };

    const fields = {
      roomNumber: get("roomNumber"),
      floor: get("floor"),
      type: get("type"),
      monthlyRent: get("monthlyRent"),
      status: get("status"),
      description: get("description"),
    };
    const isBlankRow = Object.values(fields).every((value) => value === "");
    if (isBlankRow) return;

    rows.push({ rowNumber, ...fields });
  });

  return rows;
}

export async function downloadRoomImportTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Rooms");
  worksheet.columns = COLUMNS.map((name) => ({ header: name, key: name, width: 16 }));
  worksheet.addRow({
    roomNumber: "A101",
    floor: "1",
    type: "Standard",
    monthlyRent: 1500,
    status: "available",
    description: "",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "room-import-template.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Verify typecheck/build**

Run: `pnpm build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 4: Check for a Vite/Node-builtin bundling warning**

Run: `pnpm build` output — look specifically for a line like `"fs" has been externalized for browser compatibility` or `Module "buffer" has been externalized`, referencing `exceljs`.

- If **no such warning appears**, skip to Step 5.
- If it **does appear**, add this alias to `vite.config.ts` (inside the existing `resolve.alias` object, alongside the current `"@"` entry) so Vite resolves `exceljs`'s browser-targeted bundle instead of its Node entry point, then re-run `pnpm build` to confirm the warning is gone:

```ts
resolve: {
  alias: {
    "@": path.resolve(import.meta.dirname, "./src"),
    exceljs: path.resolve(import.meta.dirname, "./node_modules/exceljs/dist/exceljs.min.js"),
  },
},
```

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no new errors from `src/lib/excel.ts`.

- [ ] **Step 6: Stop for review**

Do not commit — leave `package.json`, `pnpm-lock.yaml`, `src/lib/excel.ts` (and `vite.config.ts` if Step 4 required it) for the user to review and commit.

---

### Task 2: i18n keys for the import feature

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations/en.ts`
- Modify: `src/i18n/translations/th.ts`

**Interfaces:**
- Produces (all consumed by Task 4's `RoomImportDialog`): `room.importRooms`, `room.importDescription`, `room.downloadTemplate`, `room.uploadFile`, `room.importSummary`, `room.importConfirm`, `room.missingColumnsError`, `room.importParseError`, `room.importResultSucceeded`, `room.importResultFailed`, `room.importErrorColumn`. Also consumed by Task 3: `validation.room.monthlyRentRequired`, `validation.room.roomNumberDuplicate`, `validation.room.invalidStatus`.

- [ ] **Step 1: Add the new keys to the `Translations` interface**

In `src/i18n/types.ts`, the `room` block currently ends with `perUnit: string;` right before its closing `};` (line 154). Add the 11 new keys there:

```ts
    leaseStart: string;
    leaseEnd: string;
    perUnit: string;
    importRooms: string;
    importDescription: string;
    downloadTemplate: string;
    uploadFile: string;
    importSummary: string;
    importConfirm: string;
    missingColumnsError: string;
    importParseError: string;
    importResultSucceeded: string;
    importResultFailed: string;
    importErrorColumn: string;
  };
```

The `validation.room` block currently ends with `waterRateNegative: string;` right before its closing `};` (line 346). Add the 3 new keys there:

```ts
      roomNumberRequired: string;
      monthlyRentNegative: string;
      electricityRateNegative: string;
      waterRateNegative: string;
      monthlyRentRequired: string;
      roomNumberDuplicate: string;
      invalidStatus: string;
    };
```

- [ ] **Step 2: Add the English strings**

In `src/i18n/translations/en.ts`, the `room` block ends with `perUnit: "/ unit",` before its closing `},`. Add:

```ts
    leaseStart: "Lease Start",
    leaseEnd: "Lease End",
    perUnit: "/ unit",
    importRooms: "Import Rooms",
    importDescription: "Upload an Excel file to create multiple rooms at once.",
    downloadTemplate: "Download Template",
    uploadFile: "Upload File",
    importSummary: "{{valid}} valid, {{invalid}} invalid",
    importConfirm: "Import {{count}} Rooms",
    missingColumnsError: "The file is missing required columns (Room Number, Monthly Rent).",
    importParseError: "Could not read this file. Please check the format and try again.",
    importResultSucceeded: "{{count}} room(s) imported successfully.",
    importResultFailed: "{{count}} row(s) failed to import.",
    importErrorColumn: "Error",
  },
```

The `validation.room` block ends with `waterRateNegative: "Water rate cannot be negative",` before its closing `},`. Add:

```ts
      roomNumberRequired: "Room number is required",
      monthlyRentNegative: "Monthly rent cannot be negative",
      electricityRateNegative: "Electricity rate cannot be negative",
      waterRateNegative: "Water rate cannot be negative",
      monthlyRentRequired: "Monthly rent is required",
      roomNumberDuplicate: "This room number already exists",
      invalidStatus: "Invalid status value",
    },
```

- [ ] **Step 3: Add the Thai strings**

In `src/i18n/translations/th.ts`, the `room` block ends with `perUnit: "/ หน่วย",` before its closing `},`. Add:

```ts
    leaseStart: "วันเริ่มสัญญา",
    leaseEnd: "วันสิ้นสุดสัญญา",
    perUnit: "/ หน่วย",
    importRooms: "นำเข้าห้องพัก",
    importDescription: "อัปโหลดไฟล์ Excel เพื่อสร้างห้องพักหลายห้องพร้อมกัน",
    downloadTemplate: "ดาวน์โหลดเทมเพลต",
    uploadFile: "อัปโหลดไฟล์",
    importSummary: "ถูกต้อง {{valid}} รายการ ไม่ถูกต้อง {{invalid}} รายการ",
    importConfirm: "นำเข้า {{count}} ห้อง",
    missingColumnsError: "ไฟล์นี้ขาดคอลัมน์ที่จำเป็น (หมายเลขห้อง, ค่าเช่ารายเดือน)",
    importParseError: "ไม่สามารถอ่านไฟล์นี้ได้ กรุณาตรวจสอบรูปแบบไฟล์แล้วลองอีกครั้ง",
    importResultSucceeded: "นำเข้าห้องสำเร็จ {{count}} ห้อง",
    importResultFailed: "นำเข้าไม่สำเร็จ {{count}} รายการ",
    importErrorColumn: "ข้อผิดพลาด",
  },
```

The `validation.room` block ends with `waterRateNegative: "ค่าน้ำต่อหน่วยต้องไม่ติดลบ",` before its closing `},`. Add:

```ts
      roomNumberRequired: "กรุณากรอกหมายเลขห้อง",
      monthlyRentNegative: "ค่าเช่ารายเดือนต้องไม่ติดลบ",
      electricityRateNegative: "ค่าไฟต่อหน่วยต้องไม่ติดลบ",
      waterRateNegative: "ค่าน้ำต่อหน่วยต้องไม่ติดลบ",
      monthlyRentRequired: "กรุณากรอกค่าเช่ารายเดือน",
      roomNumberDuplicate: "หมายเลขห้องนี้มีอยู่แล้ว",
      invalidStatus: "ค่าสถานะไม่ถูกต้อง",
    },
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm build`
Expected: succeeds. If either dictionary is missing a key, `tsc -b` fails with a "Property '...' is missing" error on that file's `: Translations` annotation — this is the mechanism that makes drift between `en.ts`/`th.ts` impossible, per `context.md`.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 6: Stop for review**

Do not commit — leave `src/i18n/types.ts`, `src/i18n/translations/en.ts`, `src/i18n/translations/th.ts` for the user to review and commit.

---

### Task 3: `src/features/rooms/roomImportValidation.ts` — row coercion + validation

**Files:**
- Create: `src/features/rooms/roomImportValidation.ts`

**Interfaces:**
- Consumes: `ParsedRoomRow` from `src/lib/excel.ts` (Task 1); `validateRoom`, `type ValidationErrors` from `src/lib/validation.ts`; `type CreateRoomInput`, `type RoomStatus` from `src/types/room.ts`.
- Produces:
  - `interface RoomImportRowResult { rowNumber: number; input: CreateRoomInput; errors: ValidationErrors; isValid: boolean }`
  - `validateImportRows(rows: ParsedRoomRow[], existingRoomNumbers: Set<string>): RoomImportRowResult[]` — `existingRoomNumbers` must already be lowercased/trimmed by the caller.

- [ ] **Step 1: Write `src/features/rooms/roomImportValidation.ts`**

```ts
import { validateRoom, type ValidationErrors } from "@/lib/validation";
import type { CreateRoomInput, RoomStatus } from "@/types/room";
import type { ParsedRoomRow } from "@/lib/excel";

export interface RoomImportRowResult {
  rowNumber: number;
  input: CreateRoomInput;
  errors: ValidationErrors;
  isValid: boolean;
}

const VALID_STATUSES: RoomStatus[] = ["available", "occupied", "maintenance", "inactive"];

function parseStatus(raw: string): RoomStatus | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return "available";
  return VALID_STATUSES.find((status) => status.toLowerCase() === trimmed.toLowerCase());
}

export function validateImportRows(
  rows: ParsedRoomRow[],
  existingRoomNumbers: Set<string>
): RoomImportRowResult[] {
  const seenInFile = new Set<string>();

  return rows.map((row) => {
    const roomNumber = row.roomNumber.trim();
    const monthlyRentRaw = row.monthlyRent.trim();
    const monthlyRent = Number(monthlyRentRaw);
    const status = parseStatus(row.status);

    const input: CreateRoomInput = {
      roomNumber,
      floor: row.floor.trim() || undefined,
      type: row.type.trim() || undefined,
      monthlyRent: Number.isFinite(monthlyRent) ? monthlyRent : 0,
      status: status ?? "available",
      description: row.description.trim() || undefined,
    };

    const errors: ValidationErrors = validateRoom(input);

    if (monthlyRentRaw === "" || !Number.isFinite(monthlyRent)) {
      errors.monthlyRent = "validation.room.monthlyRentRequired";
    }

    if (status === undefined && row.status.trim() !== "") {
      errors.status = "validation.room.invalidStatus";
    }

    if (roomNumber !== "") {
      const normalized = roomNumber.toLowerCase();
      if (existingRoomNumbers.has(normalized) || seenInFile.has(normalized)) {
        errors.roomNumber = "validation.room.roomNumberDuplicate";
      }
      seenInFile.add(normalized);
    }

    return {
      rowNumber: row.rowNumber,
      input,
      errors,
      isValid: Object.keys(errors).length === 0,
    };
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm build`
Expected: succeeds with no TypeScript errors. (This module has no UI, so this typecheck plus Task 5's end-to-end manual pass are its only verification — the repo has no unit test runner to exercise it in isolation, per Global Constraints.)

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Stop for review**

Do not commit — leave `src/features/rooms/roomImportValidation.ts` for the user to review and commit.

---

### Task 4: `src/features/rooms/RoomImportDialog.tsx` — the import dialog

**Files:**
- Create: `src/features/rooms/RoomImportDialog.tsx`

**Interfaces:**
- Consumes: `downloadRoomImportTemplate`, `parseRoomImportFile`, `MissingColumnsError` from `src/lib/excel.ts` (Task 1); `validateImportRows`, `type RoomImportRowResult` from `src/features/rooms/roomImportValidation.ts` (Task 3); `useRooms()` -> `{ rooms, createRoom }` (existing, `src/hooks/useRooms.ts`); `useLanguage()` -> `{ t }` (existing, `@/i18n`); existing UI primitives `Dialog`/`DialogContent`/`DialogDescription`/`DialogFooter`/`DialogHeader`/`DialogTitle` (`@/components/ui/dialog`), `Button` (`@/components/ui/button`), `Checkbox` (`@/components/ui/checkbox`), `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` (`@/components/ui/table`).
- Produces: `RoomImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void })`, a self-contained component with no other exports — consumed by Task 5's `RoomsPage.tsx`.

- [ ] **Step 1: Write `src/features/rooms/RoomImportDialog.tsx`**

```tsx
import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n";
import { useRooms } from "@/hooks/useRooms";
import { downloadRoomImportTemplate, parseRoomImportFile, MissingColumnsError } from "@/lib/excel";
import { validateImportRows, type RoomImportRowResult } from "@/features/rooms/roomImportValidation";

interface RoomImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "preview" | "result";

interface ImportOutcome {
  succeeded: string[];
  failed: { roomNumber: string; message: string }[];
}

export function RoomImportDialog({ open, onOpenChange }: RoomImportDialogProps) {
  const { t } = useLanguage();
  const { rooms, createRoom } = useRooms();
  const [step, setStep] = useState<Step>("upload");
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<RoomImportRowResult[]>([]);
  const [includedRowNumbers, setIncludedRowNumbers] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | undefined>(undefined);

  function reset() {
    setStep("upload");
    setFileError(undefined);
    setRows([]);
    setIncludedRowNumbers(new Set());
    setIsImporting(false);
    setOutcome(undefined);
  }

  function handleOpenChange(next: boolean) {
    if (!next && isImporting) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setFileError(undefined);
    try {
      const parsed = await parseRoomImportFile(file);
      const existingRoomNumbers = new Set(rooms.map((room) => room.roomNumber.trim().toLowerCase()));
      const validated = validateImportRows(parsed, existingRoomNumbers);
      setRows(validated);
      setIncludedRowNumbers(new Set(validated.filter((row) => row.isValid).map((row) => row.rowNumber)));
      setStep("preview");
    } catch (error) {
      setFileError(error instanceof MissingColumnsError ? t("room.missingColumnsError") : t("room.importParseError"));
    }
  }

  function toggleRow(rowNumber: number, checked: boolean) {
    setIncludedRowNumbers((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowNumber);
      else next.delete(rowNumber);
      return next;
    });
  }

  async function handleConfirm() {
    if (isImporting) return;
    const toImport = rows.filter((row) => includedRowNumbers.has(row.rowNumber));
    if (toImport.length === 0) return;

    setIsImporting(true);
    const settled = await Promise.allSettled(toImport.map((row) => createRoom(row.input)));

    const succeeded: string[] = [];
    const failed: { roomNumber: string; message: string }[] = [];
    settled.forEach((result, index) => {
      const row = toImport[index];
      if (result.status === "fulfilled") {
        succeeded.push(row.input.roomNumber);
      } else {
        failed.push({ roomNumber: row.input.roomNumber, message: t("common.actionFailed") });
      }
    });

    setOutcome({ succeeded, failed });
    setIsImporting(false);
    setStep("result");
    toast.success(t("room.importResultSucceeded", { count: succeeded.length }));
  }

  const validCount = rows.filter((row) => row.isValid).length;
  const invalidCount = rows.length - validCount;
  const includedCount = includedRowNumbers.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("room.importRooms")}</DialogTitle>
          <DialogDescription>{t("room.importDescription")}</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <Button type="button" variant="outline" onClick={() => void downloadRoomImportTemplate()}>
              {t("room.downloadTemplate")}
            </Button>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="room-import-file">
                {t("room.uploadFile")}
              </label>
              <input
                id="room-import-file"
                type="file"
                accept=".xlsx"
                onChange={(event) => void handleFileChange(event)}
                className="block text-sm"
              />
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("room.importSummary", { valid: validCount, invalid: invalidCount })}
            </p>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>{t("room.roomNumber")}</TableHead>
                    <TableHead>{t("room.floor")}</TableHead>
                    <TableHead>{t("room.type")}</TableHead>
                    <TableHead>{t("room.monthlyRent")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("room.importErrorColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell>
                        <Checkbox
                          checked={includedRowNumbers.has(row.rowNumber)}
                          disabled={!row.isValid}
                          onCheckedChange={(checked) => toggleRow(row.rowNumber, checked === true)}
                        />
                      </TableCell>
                      <TableCell>{row.input.roomNumber}</TableCell>
                      <TableCell>{row.input.floor ?? ""}</TableCell>
                      <TableCell>{row.input.type ?? ""}</TableCell>
                      <TableCell>{row.input.monthlyRent}</TableCell>
                      <TableCell>{t(`status.${row.input.status ?? "available"}`)}</TableCell>
                      <TableCell className="text-destructive">
                        {Object.values(row.errors).map((key) => t(key)).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "result" && outcome && (
          <div className="space-y-2 text-sm">
            <p>{t("room.importResultSucceeded", { count: outcome.succeeded.length })}</p>
            {outcome.failed.length > 0 && (
              <div className="space-y-1">
                <p className="text-destructive">
                  {t("room.importResultFailed", { count: outcome.failed.length })}
                </p>
                <ul className="list-inside list-disc">
                  {outcome.failed.map((failure) => (
                    <li key={failure.roomNumber}>
                      {failure.roomNumber}: {failure.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step !== "result" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isImporting}>
              {t("common.cancel")}
            </Button>
          )}
          {step === "preview" && (
            <Button onClick={() => void handleConfirm()} disabled={includedCount === 0 || isImporting}>
              {t("room.importConfirm", { count: includedCount })}
            </Button>
          )}
          {step === "result" && <Button onClick={() => handleOpenChange(false)}>{t("common.close")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Stop for review**

Do not commit — leave `src/features/rooms/RoomImportDialog.tsx` for the user to review and commit. This component isn't reachable from the UI yet (Task 5 wires it in) so it can't be manually smoke-tested in isolation.

---

### Task 5: Wire `RoomImportDialog` into `RoomsPage` + end-to-end verification

**Files:**
- Modify: `src/features/rooms/RoomsPage.tsx`

**Interfaces:**
- Consumes: `RoomImportDialog` from `src/features/rooms/RoomImportDialog.tsx` (Task 4).

- [ ] **Step 1: Add the import and state**

In `src/features/rooms/RoomsPage.tsx`, add the import next to the existing `RoomFormDialog` import (line 12):

```ts
import { RoomFormDialog } from "@/features/rooms/RoomFormDialog";
import { RoomImportDialog } from "@/features/rooms/RoomImportDialog";
```

Add `Upload` to the existing `lucide-react` import (line 3):

```ts
import { DoorOpen, Plus, Search, Upload } from "lucide-react";
```

Add import-dialog open state next to `formOpen` (line 40):

```ts
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
```

- [ ] **Step 2: Add the "Import" button next to "Add Room"**

Replace the `PageHeader`'s `actions` prop (lines 89-100):

```tsx
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setEditingRoom(undefined);
                setFormOpen(true);
              }}
            >
              <Plus /> {t("room.addRoom")}
            </Button>
          )
        }
```

with:

```tsx
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload /> {t("room.importRooms")}
              </Button>
              <Button
                onClick={() => {
                  setEditingRoom(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus /> {t("room.addRoom")}
              </Button>
            </div>
          )
        }
```

- [ ] **Step 3: Render the dialog**

Add `<RoomImportDialog />` next to the existing `<RoomFormDialog ... />` render (after line 175, before `<RoomDetailSheet`):

```tsx
      <RoomImportDialog open={importOpen} onOpenChange={setImportOpen} />
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 6: Manual end-to-end verification against the Firebase Emulator Suite**

Run: `pnpm dev` (with the emulator suite running per `docs/firebase/setup.md`), sign in as an `admin` user, go to the Rooms page.

1. Click "Import Rooms" -> "Download Template" -> confirm an `.xlsx` file downloads with headers `roomNumber, floor, type, monthlyRent, status, description` and one example row (`A101`).
2. Fill 3 rows in the downloaded file with distinct valid `roomNumber`/`monthlyRent` values, upload it -> preview shows all 3 as valid, checked; confirm -> all 3 rooms appear in the Rooms table.
3. Build a second file: one row with a blank `roomNumber`, one row with `monthlyRent` = `-100`, one valid row -> preview shows 2 invalid (unchecked, disabled, with the correct error text) and 1 valid (checked); confirm imports only the valid one.
4. Build a file where one row's `roomNumber` matches a room already in the table -> flagged `validation.room.roomNumberDuplicate` text in the preview.
5. Build a file with two rows sharing the same `roomNumber` -> the second occurrence is flagged as a duplicate.
6. Toggle the language switch (ไทย/EN) while the dialog is open at the upload step, the preview step, and the result step -> all visible copy switches language, including the error/summary/confirm-button text.
7. Sign in as a `staff`-role user -> confirm the "Import Rooms" button is not rendered (same gate as "+ Add Room").

- [ ] **Step 7: Stop for review**

Do not commit — leave `src/features/rooms/RoomsPage.tsx` for the user to review and commit. Report the manual verification results (pass/fail per numbered check above) back to the user.
