import { useLanguage } from "@/i18n";
import { formatAmount } from "@/lib/currency";
import { formatBillingMonth, formatDate } from "@/lib/date";
import type { InvoiceRecord } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";
import type { PropertySettings } from "@/types/settings";

interface InvoicePrintViewProps {
  record: InvoiceRecord;
  room: Room;
  tenant?: Tenant;
  settings: PropertySettings;
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  return phone;
}

export function InvoicePrintView({ record, room, settings }: InvoicePrintViewProps) {
  const { t, language } = useLanguage();
  const noteLines = (settings.defaultInvoiceNote ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div id="invoice-print-area" className="bg-white p-8 text-black">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-blue-900 sm:text-3xl">{t("invoice.documentTitle")}</h1>
        <div className="rounded-xl border-2 border-blue-900 px-6 py-3 text-center">
          <p className="text-xs text-blue-900">{t("invoice.invoiceNo")}</p>
          <p className="text-lg font-bold text-blue-900">{record.invoiceNumber ?? "-"}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <table className="w-full border-collapse border border-blue-900 text-sm">
          <tbody>
            <tr>
              <td className="w-40 border border-blue-900 px-3 py-2 font-medium">{t("invoice.date")}</td>
              <td className="border border-blue-900 px-3 py-2 text-xs">{formatDate(record.issuedAt, language)}</td>
            </tr>
            <tr>
              <td className="border border-blue-900 px-3 py-2 font-medium">{t("invoice.billingPeriodLabel")}</td>
              <td className="border border-blue-900 px-3 py-2 text-xs">{formatBillingMonth(record.billingMonth, language)}</td>
            </tr>
            <tr>
              <td className="border border-blue-900 px-3 py-2 font-medium">{t("common.dueDate")}</td>
              <td className="border border-blue-900 px-3 py-2 text-xs">{record.dueDate ? formatDate(record.dueDate, language) : "-"}</td>
            </tr>
          </tbody>
        </table>
        <table className="w-full border-collapse border border-blue-900 text-sm">
          <tbody>
            <tr>
              <td className="w-40 border border-blue-900 px-3 py-2 font-medium">{t("invoice.roomLabel")}</td>
              <td className="border border-blue-900 px-3 py-2 text-xs">{room.roomNumber}</td>
            </tr>
            <tr>
              <td className="border border-blue-900 px-3 py-2 font-medium">{t("invoice.propertyAddressLabel")}</td>
              <td className="border border-blue-900 px-3 py-2 text-xs">{room.description || "-"}</td>
            </tr>
            <tr>
              <td className="border border-blue-900 px-3 py-2 font-medium">{t("invoice.phoneLabel")}</td>
              <td className="border border-blue-900 px-3 py-2 text-xs">
                {settings.phone ? formatPhoneNumber(settings.phone) : "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-blue-900 text-white">
            <th className="px-2 py-2 text-left font-medium">{t("invoice.itemColumn")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("invoice.previousReadingColumn")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("invoice.currentReadingColumn")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("invoice.unitsColumn")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("invoice.rateColumn")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("invoice.amountColumn")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-1.5 px-2">{t("invoice.rentItem")}</td>
            <td className="py-1.5 px-2 text-right">—</td>
            <td className="py-1.5 px-2 text-right">—</td>
            <td className="py-1.5 px-2 text-right">—</td>
            <td className="py-1.5 px-2 text-right">—</td>
            <td className="py-1.5 px-2 text-right">{record.rentAmount.toFixed(2)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1.5 px-2">{t("invoice.electricityItem")}</td>
            <td className="py-1.5 px-2 text-right">{record.electricity.previousMeter}</td>
            <td className="py-1.5 px-2 text-right">{record.electricity.currentMeter}</td>
            <td className="py-1.5 px-2 text-right">{record.electricity.usage}</td>
            <td className="py-1.5 px-2 text-right">{record.electricity.rate.toFixed(2)}</td>
            <td className="py-1.5 px-2 text-right">{record.electricity.amount.toFixed(2)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1.5 px-2">{t("invoice.waterItem")}</td>
            <td className="py-1.5 px-2 text-right">{record.water.previousMeter}</td>
            <td className="py-1.5 px-2 text-right">{record.water.currentMeter}</td>
            <td className="py-1.5 px-2 text-right">{record.water.usage}</td>
            <td className="py-1.5 px-2 text-right">{record.water.rate.toFixed(2)}</td>
            <td className="py-1.5 px-2 text-right">{record.water.amount.toFixed(2)}</td>
          </tr>
          {record.otherCharges.map((charge) => (
            <tr key={charge.id} className="border-b">
              <td className="py-1.5 px-2">{charge.name}</td>
              <td className="py-1.5 px-2 text-right">—</td>
              <td className="py-1.5 px-2 text-right">—</td>
              <td className="py-1.5 px-2 text-right">—</td>
              <td className="py-1.5 px-2 text-right">—</td>
              <td className="py-1.5 px-2 text-right">{charge.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-6 flex justify-end border-t-2 border-blue-900 pt-2">
        <p className="text-lg font-bold">
          {t("invoice.totalLabel")}: <span className="text-blue-900">{formatAmount(record.total, language)}</span>{" "}
          {t("invoice.currencyUnit")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          {noteLines.length > 0 && (
            <>
              <p className="mb-1 font-medium">{t("invoice.remark")}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {noteLines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <table className="w-full border-collapse border border-blue-900 text-sm">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th colSpan={2} className="px-2 py-2 text-center font-medium">
                {t("invoice.paymentInfoTitle")}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="w-40 border border-blue-900 px-3 py-2 font-medium">{t("invoice.paidDateLabel")}</td>
              <td className="border border-blue-900 px-3 py-2 text-xs">-</td>
            </tr>
            <tr>
              <td className="border border-blue-900 px-3 py-2 font-medium">{t("invoice.paymentMethodLabel")}</td>
              <td className="border border-blue-900 px-3 py-2 text-xs">-</td>
            </tr>
            <tr>
              <td className="border border-blue-900 px-3 py-2 font-medium">{t("invoice.paidAmountLabel")}</td>
              <td className="border border-blue-900 px-3 py-2 text-xs">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
