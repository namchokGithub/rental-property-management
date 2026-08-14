import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { PageSpinner } from "@/components/common/PageSpinner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { InvoicePrintView } from "@/features/invoices/InvoicePrintView";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useSettings } from "@/hooks/useSettings";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useLanguage } from "@/i18n";
import { invoiceRecordsFromBilling } from "@/types/billing";

export function InvoiceBulkPrintPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { records, isLoading: billingLoading } = useBillingRecords();
  const { settings, isLoading: settingsLoading } = useSettings();
  const { rooms, isLoading: roomsLoading } = useRooms();
  const { tenants, isLoading: tenantsLoading } = useTenants();

  if (billingLoading || settingsLoading || roomsLoading || tenantsLoading || !settings) return <PageSpinner />;

  const requestedIds = new Set((searchParams.get("ids") ?? "").split(",").filter(Boolean));
  const invoices = records.flatMap(invoiceRecordsFromBilling).filter((invoice) => requestedIds.has(invoice.id));

  if (invoices.length === 0) {
    return (
      <div className="p-6">
        {t("invoice.notFound")}{" "}
        <Button variant="link" onClick={() => navigate("/invoices")}>
          {t("invoice.backToInvoices")}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="no-print flex items-center justify-between gap-2 border-b bg-card p-3">
        <Button variant="ghost" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-4 w-4" /> {t("invoice.back")}
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> {t("invoice.print")}
        </Button>
      </div>
      <div className="mx-auto max-w-3xl space-y-4 p-4 print:space-y-0 print:p-0">
        {invoices.map((record) => {
          const room = rooms.find((r) => r.id === record.roomId);
          const tenant = record.tenantId ? tenants.find((tn) => tn.id === record.tenantId) : undefined;
          if (!room) return null;
          return (
            <div key={record.id} className="invoice-bulk-print-item">
              <InvoicePrintView record={record} room={room} tenant={tenant} settings={settings} />
            </div>
          );
        })}
      </div>
      <Toaster richColors closeButton />
    </div>
  );
}
