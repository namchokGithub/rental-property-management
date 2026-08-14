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

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

  await downloadWorkbook(workbook, "room-import-template.xlsx");
}

export interface InvoiceExportRow {
  billingMonth: string;
  roomLabel: string;
  rent: number;
  water: number;
  electricity: number;
  otherCharges: number;
  total: number;
}

export interface InvoiceExportLabels {
  exportDateLabel: string;
  exportByLabel: string;
  billingMonth: string;
  item: string;
  rent: string;
  water: string;
  electricity: string;
  other: string;
  total: string;
}

const EXPORT_LABEL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8CBAD" } };
const EXPORT_HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

export async function downloadInvoiceExcelExport(
  rows: InvoiceExportRow[],
  meta: { exportedAt: string; exportedBy: string },
  labels: InvoiceExportLabels,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Invoices");
  worksheet.columns = [{ width: 18 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 }];

  const labelCell = (address: string, text: string) => {
    const cell = worksheet.getCell(address);
    cell.value = text;
    cell.font = { bold: true };
    cell.fill = EXPORT_LABEL_FILL;
  };
  labelCell("A1", labels.exportDateLabel);
  worksheet.getCell("B1").value = meta.exportedAt;
  labelCell("A2", labels.exportByLabel);
  worksheet.getCell("B2").value = meta.exportedBy;

  const headerRow = worksheet.getRow(4);
  [labels.billingMonth, labels.item, labels.rent, labels.water, labels.electricity, labels.other, labels.total].forEach(
    (text, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = text;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = EXPORT_HEADER_FILL;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    },
  );

  rows.forEach((row, index) => {
    const dataRow = worksheet.getRow(5 + index);
    dataRow.getCell(1).value = row.billingMonth;
    dataRow.getCell(2).value = row.roomLabel;
    dataRow.getCell(3).value = row.rent;
    dataRow.getCell(4).value = row.water;
    dataRow.getCell(5).value = row.electricity;
    dataRow.getCell(6).value = row.otherCharges;
    dataRow.getCell(7).value = row.total;
    for (let col = 3; col <= 7; col++) {
      dataRow.getCell(col).numFmt = "#,##0.00";
    }
  });

  const timestamp = meta.exportedAt.replace(/[^0-9]/g, "-");
  await downloadWorkbook(workbook, `invoices-export-${timestamp}.xlsx`);
}
