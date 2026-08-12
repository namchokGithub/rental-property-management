import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileUp, Lightbulb, Upload } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/i18n";
import {
  validateImportRows,
  type RoomImportRowResult,
} from "@/features/rooms/roomImportValidation";
import type { Room, CreateRoomInput } from "@/types/room";

interface RoomImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  createRoom: (input: CreateRoomInput) => Promise<string>;
}

type Step = "upload" | "preview" | "result";

interface ImportOutcome {
  succeeded: string[];
  failed: { roomNumber: string; message: string }[];
}

export function RoomImportDialog({
  open,
  onOpenChange,
  rooms,
  createRoom,
}: RoomImportDialogProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("upload");
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<RoomImportRowResult[]>([]);
  const [includedRowNumbers, setIncludedRowNumbers] = useState<Set<number>>(
    new Set(),
  );
  const [isImporting, setIsImporting] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | undefined>(undefined);
  const importGenerationRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function reset() {
    importGenerationRef.current += 1;
    setStep("upload");
    setFileError(undefined);
    setRows([]);
    setIncludedRowNumbers(new Set());
    setIsImporting(false);
    setOutcome(undefined);
    setIsDragging(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function preventCloseWhileImporting(event: Event) {
    if (isImporting) event.preventDefault();
  }

  async function importFile(file: File) {
    if (!file) return;

    setFileError(undefined);
    const { parseRoomImportFile, MissingColumnsError } =
      await import("@/lib/excel");
    try {
      const parsed = await parseRoomImportFile(file);
      const existingRoomNumbers = new Set(
        rooms.map((room) => room.roomNumber.trim().toLowerCase()),
      );
      const validated = validateImportRows(parsed, existingRoomNumbers);
      setRows(validated);
      setIncludedRowNumbers(
        new Set(
          validated.filter((row) => row.isValid).map((row) => row.rowNumber),
        ),
      );
      setStep("preview");
    } catch (error) {
      setFileError(
        error instanceof MissingColumnsError
          ? t("room.missingColumnsError")
          : t("room.importParseError"),
      );
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await importFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void importFile(file);
  }

  async function handleDownloadTemplate() {
    try {
      const { downloadRoomImportTemplate } = await import("@/lib/excel");
      await downloadRoomImportTemplate();
    } catch {
      toast.error(t("common.actionFailed"));
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
    const toImport = rows.filter((row) =>
      includedRowNumbers.has(row.rowNumber),
    );
    if (toImport.length === 0) return;

    const generation = ++importGenerationRef.current;
    setIsImporting(true);
    const settled = await Promise.allSettled(
      toImport.map((row) => createRoom(row.input)),
    );
    if (generation !== importGenerationRef.current) return;

    const succeeded: string[] = [];
    const failed: { roomNumber: string; message: string }[] = [];
    settled.forEach((result, index) => {
      const row = toImport[index];
      if (result.status === "fulfilled") {
        succeeded.push(row.input.roomNumber);
      } else {
        failed.push({
          roomNumber: row.input.roomNumber,
          message: t("common.actionFailed"),
        });
      }
    });

    setOutcome({ succeeded, failed });
    setIsImporting(false);
    setStep("result");
    if (succeeded.length > 0)
      toast.success(
        t("room.importResultSucceeded", { count: succeeded.length }),
      );
    if (failed.length > 0) toast.error(t("common.actionFailed"));
  }

  const validCount = rows.filter((row) => row.isValid).length;
  const invalidCount = rows.length - validCount;
  const includedCount = includedRowNumbers.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto p-5 sm:max-w-5xl sm:p-12"
        onEscapeKeyDown={preventCloseWhileImporting}
        onPointerDownOutside={preventCloseWhileImporting}>
        <DialogHeader className="gap-3 pr-8 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-accent text-primary">
            <FileUp className="h-8 w-8" />
          </span>
          <div className="space-y-1.5">
            <DialogTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("room.importRooms")}
            </DialogTitle>
            <DialogDescription className="text-base sm:text-lg">
              {t("room.importDescription")}
            </DialogDescription>
          </div>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-5">
            <div
              className="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/45 bg-accent/35 px-4 py-8 text-center transition-colors hover:border-primary hover:bg-accent/55 data-[dragging=true]:border-primary data-[dragging=true]:bg-accent/70"
              onDragEnter={handleDragOver}
              onDragOver={handleDragOver}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              data-dragging={isDragging ? "true" : undefined}>
              <Upload className="mb-4 h-14 w-14 text-primary" />
              <p className="text-xl font-semibold">{t("room.dragFileHere")}</p>
              <p className="mt-1 text-muted-foreground">{t("room.chooseFileHint")}</p>
              <Button
                type="button"
                size="lg"
                className="mt-6"
                onClick={() => fileInputRef.current?.click()}>
                <Upload /> {t("room.chooseFile")}
              </Button>
              <input
                ref={fileInputRef}
                id="room-import-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => void handleFileChange(event)}
                className="sr-only"
              />
            </div>
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              {t("room.supportedExcel")}
            </p>
            {fileError && <p className="text-center text-sm text-destructive">{fileError}</p>}
            <div className="flex flex-col gap-3 rounded-xl border border-primary/15 bg-accent/45 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-3 text-sm sm:text-base">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>{t("room.importTip")}</span>
              </p>
              <Button type="button" variant="outline" onClick={() => void handleDownloadTemplate()}>
                <Download /> {t("room.downloadTemplate")}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("room.importSummary", {
                valid: validCount,
                invalid: invalidCount,
              })}
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
                          onCheckedChange={(checked) =>
                            toggleRow(row.rowNumber, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell>{row.input.roomNumber}</TableCell>
                      <TableCell>{row.input.floor ?? ""}</TableCell>
                      <TableCell>{row.input.type ?? ""}</TableCell>
                      <TableCell>{row.input.monthlyRent}</TableCell>
                      <TableCell>
                        {t(`status.${row.input.status ?? "available"}`)}
                      </TableCell>
                      <TableCell className="text-destructive">
                        {Object.values(row.errors)
                          .map((key) => t(key))
                          .join(", ")}
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
            {outcome.succeeded.length > 0 && (
              <p>
                {t("room.importResultSucceeded", {
                  count: outcome.succeeded.length,
                })}
              </p>
            )}
            {outcome.failed.length > 0 && (
              <div className="space-y-1">
                <p className="text-destructive">
                  {t("room.importResultFailed", {
                    count: outcome.failed.length,
                  })}
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

        <DialogFooter className="border-t pt-5">
          {step !== "result" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {t("common.cancel")}
            </Button>
          )}
          {step === "preview" && (
            <Button
              onClick={() => void handleConfirm()}
              disabled={includedCount === 0 || isImporting}>
              {t("room.importConfirm", { count: includedCount })}
            </Button>
          )}
          {step === "result" && (
            <Button onClick={() => handleOpenChange(false)}>
              {t("common.close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
