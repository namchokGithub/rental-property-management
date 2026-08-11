import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import type { BillingRecord } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";
import type { PropertySettings } from "@/types/settings";

interface InvoicePrintViewProps {
  record: BillingRecord;
  room: Room;
  tenant?: Tenant;
  settings: PropertySettings;
}

export function InvoicePrintView({ record, room, tenant, settings }: InvoicePrintViewProps) {
  const { t, language } = useLanguage();

  return (
    <div id="invoice-print-area" className="bg-white p-8 text-black">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold">{t("invoice.documentTitle")}</h1>
        <p className="mt-1 font-medium">{settings.propertyName}</p>
        {settings.propertyAddress && <p className="text-sm">{settings.propertyAddress}</p>}
        {settings.phone && (
          <p className="text-sm">
            {t("invoice.phonePrefix")}
            {settings.phone}
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <p>
          <span className="font-medium">{t("invoice.date")}:</span>{" "}
          {formatDate(record.issuedAt ?? record.createdAt, language)}
        </p>
        <p>
          <span className="font-medium">{t("invoice.invoiceNo")}:</span> {record.invoiceNumber ?? "-"}
        </p>
        <p>
          <span className="font-medium">{t("invoice.tenantLabel")}:</span>{" "}
          {tenant ? tenant.name : "-"}
        </p>
        <p>
          <span className="font-medium">{t("invoice.roomLabel")}:</span> {room.roomNumber}
        </p>
        <p>
          <span className="font-medium">{t("invoice.statusLabel")}:</span> {t(`status.${record.status}`)}
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1.5 text-left">{t("invoice.itemColumn")}</th>
            <th className="py-1.5 text-right">{t("invoice.previousReadingColumn")}</th>
            <th className="py-1.5 text-right">{t("invoice.currentReadingColumn")}</th>
            <th className="py-1.5 text-right">{t("invoice.unitsColumn")}</th>
            <th className="py-1.5 text-right">{t("invoice.rateColumn")}</th>
            <th className="py-1.5 text-right">{t("invoice.amountColumn")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-1.5">{t("invoice.rentItem")}</td>
            <td className="py-1.5 text-right">—</td>
            <td className="py-1.5 text-right">—</td>
            <td className="py-1.5 text-right">—</td>
            <td className="py-1.5 text-right">—</td>
            <td className="py-1.5 text-right">{record.rentAmount.toFixed(2)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1.5">{t("invoice.electricityItem")}</td>
            <td className="py-1.5 text-right">{record.electricity.previousMeter}</td>
            <td className="py-1.5 text-right">{record.electricity.currentMeter}</td>
            <td className="py-1.5 text-right">{record.electricity.usage}</td>
            <td className="py-1.5 text-right">{record.electricity.rate.toFixed(2)}</td>
            <td className="py-1.5 text-right">{record.electricity.amount.toFixed(2)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1.5">{t("invoice.waterItem")}</td>
            <td className="py-1.5 text-right">{record.water.previousMeter}</td>
            <td className="py-1.5 text-right">{record.water.currentMeter}</td>
            <td className="py-1.5 text-right">{record.water.usage}</td>
            <td className="py-1.5 text-right">{record.water.rate.toFixed(2)}</td>
            <td className="py-1.5 text-right">{record.water.amount.toFixed(2)}</td>
          </tr>
          {record.otherCharges.map((charge) => (
            <tr key={charge.id} className="border-b">
              <td className="py-1.5">{t("invoice.otherChargeItem", { name: charge.name })}</td>
              <td className="py-1.5 text-right">—</td>
              <td className="py-1.5 text-right">—</td>
              <td className="py-1.5 text-right">—</td>
              <td className="py-1.5 text-right">—</td>
              <td className="py-1.5 text-right">{charge.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end border-t-2 border-black pt-2">
        <p className="text-lg font-bold">{t("invoice.totalLine", { amount: formatCurrency(record.total, language) })}</p>
      </div>

      {settings.defaultInvoiceNote && (
        <div className="mt-6 text-sm">
          <p className="font-medium">{t("invoice.remark")}</p>
          <p>{settings.defaultInvoiceNote}</p>
        </div>
      )}
    </div>
  );
}
