import { validateRoom, type ValidationErrors } from "@/lib/validation";
import type { CreateRoomInput, RoomStatus } from "@/types/room";
import type { ParsedRoomRow } from "@/lib/excel";

export interface RoomImportRowResult {
  rowNumber: number;
  input: CreateRoomInput;
  errors: ValidationErrors;
  isValid: boolean;
}

const VALID_STATUSES: RoomStatus[] = [
  "available",
  "occupied",
  "maintenance",
  "inactive",
];

function parseStatus(raw: string): RoomStatus | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return "available";
  return VALID_STATUSES.find(
    (status) => status.toLowerCase() === trimmed.toLowerCase(),
  );
}

export function validateImportRows(
  rows: ParsedRoomRow[],
  existingRoomNumbers: Set<string>,
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
