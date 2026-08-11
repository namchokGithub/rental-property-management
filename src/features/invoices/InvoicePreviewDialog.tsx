import { useNavigate } from "react-router";
import { Printer, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InvoicePrintView } from "@/features/invoices/InvoicePrintView";
import { useAuth } from "@/auth";
import { useLanguage } from "@/i18n";
import { resolveInvoiceStatus } from "@/lib/invoice";
import type { InvoiceRecord } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";
import type { PropertySettings } from "@/types/settings";

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: InvoiceRecord;
  room?: Room;
  tenant?: Tenant;
  settings: PropertySettings;
  onMarkPaid: (record: InvoiceRecord) => void;
}

export function InvoicePreviewDialog({ open, onOpenChange, record, room, tenant, settings, onMarkPaid }: InvoicePreviewDialogProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  if (!record || !room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("invoice.previewTitle")}</DialogTitle>
        </DialogHeader>
        <InvoicePrintView record={record} room={room} tenant={tenant} settings={settings} />
        <DialogFooter>
          {isAdmin && (resolveInvoiceStatus(record) === "issued" || resolveInvoiceStatus(record) === "overdue") && (
            <Button variant="outline" onClick={() => onMarkPaid(record)}>
              <CheckCircle2 className="h-4 w-4" /> {t("invoice.markAsPaid")}
            </Button>
          )}
          <Button onClick={() => navigate(`/invoices/${record.billingId}?invoice=${record.id}`)}>
            <Printer className="h-4 w-4" /> {t("invoice.openFullPreview")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
