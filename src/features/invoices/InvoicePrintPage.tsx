import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Printer, CheckCircle2 } from "lucide-react";
import { PageSpinner } from "@/components/common/PageSpinner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { InvoicePrintView } from "@/features/invoices/InvoicePrintView";
import { useAuth } from "@/auth";
import { useBillingRecords } from "@/hooks/useBillingRecords";
import { useSettings } from "@/hooks/useSettings";
import { useRooms } from "@/hooks/useRooms";
import { useTenants } from "@/hooks/useTenants";
import { useLanguage } from "@/i18n";
import { resolveBillingStatus } from "@/lib/invoice";

export function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { records, isLoading: billingLoading, updateBilling } = useBillingRecords();
  const { settings, isLoading: settingsLoading } = useSettings();
  const { rooms, isLoading: roomsLoading } = useRooms();
  const { tenants, isLoading: tenantsLoading } = useTenants();
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  if (billingLoading || settingsLoading || roomsLoading || tenantsLoading || !settings) return <PageSpinner />;

  const record = id ? records.find((r) => r.id === id) : undefined;

  if (!record) {
    return (
      <div className="p-6">
        {t("invoice.notFound")}{" "}
        <Button variant="link" onClick={() => navigate("/invoices")}>
          {t("invoice.backToInvoices")}
        </Button>
      </div>
    );
  }

  const room = rooms.find((r) => r.id === record.roomId);
  const tenant = record.tenantId ? tenants.find((tn) => tn.id === record.tenantId) : undefined;

  if (!room) {
    return <div className="p-6">{t("invoice.roomNotFound")}</div>;
  }

  const status = resolveBillingStatus(record);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="no-print flex items-center justify-between gap-2 border-b bg-card p-3">
        <Button variant="ghost" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-4 w-4" /> {t("invoice.back")}
        </Button>
        <div className="flex gap-2">
          {isAdmin && (status === "issued" || status === "overdue") && (
            <Button
              variant="outline"
              disabled={isMarkingPaid}
              onClick={async () => {
                setIsMarkingPaid(true);
                try {
                  await updateBilling(record.id, { status: "paid" });
                  toast.success(t("invoice.paidToast"));
                } catch {
                  toast.error(t("common.actionFailed"));
                } finally {
                  setIsMarkingPaid(false);
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> {t("invoice.markAsPaid")}
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> {t("invoice.print")}
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-3xl p-4 print:p-0">
        <InvoicePrintView record={record} room={room} tenant={tenant} settings={settings} />
      </div>
      <Toaster richColors closeButton />
    </div>
  );
}
