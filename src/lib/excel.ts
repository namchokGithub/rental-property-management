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
