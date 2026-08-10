import { useNavigate } from "react-router";
import { Printer, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InvoicePrintView } from "@/features/invoices/InvoicePrintView";
import { useLanguage } from "@/i18n";
import { resolveBillingStatus } from "@/lib/invoice";
import type { BillingRecord } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";
import type { PropertySettings } from "@/types/settings";

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: BillingRecord;
  room?: Room;
  tenant?: Tenant;
  settings: PropertySettings;
  onMarkPaid: (record: BillingRecord) => void;
}

export function InvoicePreviewDialog({ open, onOpenChange, record, room, tenant, settings, onMarkPaid }: InvoicePreviewDialogProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  if (!record || !room) return null;

  const status = resolveBillingStatus(record);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("invoice.previewTitle")}</DialogTitle>
        </DialogHeader>
        <InvoicePrintView record={record} room={room} tenant={tenant} settings={settings} />
        <DialogFooter>
          {(status === "issued" || status === "overdue") && (
            <Button variant="outline" onClick={() => onMarkPaid(record)}>
              <CheckCircle2 className="h-4 w-4" /> {t("invoice.markAsPaid")}
            </Button>
          )}
          <Button onClick={() => navigate(`/invoices/${record.id}`)}>
            <Printer className="h-4 w-4" /> {t("invoice.openFullPreview")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
