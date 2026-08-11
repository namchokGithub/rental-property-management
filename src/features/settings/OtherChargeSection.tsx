import { useState } from "react";
import { toast } from "sonner";
import { Plus, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { OtherChargeTable } from "@/features/settings/OtherChargeTable";
import { OtherChargeFormDialog } from "@/features/settings/OtherChargeFormDialog";
import { useAuth } from "@/auth";
import { useOtherCharges } from "@/hooks/useOtherCharges";
import { useLanguage } from "@/i18n";
import type { OtherChargeMaster } from "@/types/otherCharge";

export function OtherChargeSection() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { otherCharges, createOtherCharge, updateOtherCharge, deleteOtherCharge } = useOtherCharges();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<OtherChargeMaster | undefined>(undefined);
  const [deletingCharge, setDeletingCharge] = useState<OtherChargeMaster | undefined>(undefined);

  function displayName(charge: OtherChargeMaster): string {
    return language === "en" && charge.nameEn ? charge.nameEn : charge.nameTh;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t("settings.otherChargesTitle")}</CardTitle>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => {
              setEditingCharge(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t("settings.otherChargesAdd")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {otherCharges.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={t("settings.otherChargesNoChargesTitle")}
            description={t("settings.otherChargesNoChargesDescription")}
            actionLabel={isAdmin ? t("settings.otherChargesAdd") : undefined}
            onAction={
              isAdmin
                ? () => {
                    setEditingCharge(undefined);
                    setFormOpen(true);
                  }
                : undefined
            }
          />
        ) : (
          <OtherChargeTable
            charges={otherCharges}
            onEdit={(charge) => {
              setEditingCharge(charge);
              setFormOpen(true);
            }}
            onDelete={setDeletingCharge}
            onToggleActive={(charge) => {
              updateOtherCharge(charge.id, { isActive: !charge.isActive });
              toast.success(charge.isActive ? t("settings.otherChargesDeactivatedToast") : t("settings.otherChargesActivatedToast"));
            }}
          />
        )}
      </CardContent>

      <OtherChargeFormDialog
        key={editingCharge?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        charge={editingCharge}
        onSubmit={(input) => {
          if (editingCharge) {
            updateOtherCharge(editingCharge.id, input);
            toast.success(t("settings.otherChargesUpdatedToast"));
          } else {
            createOtherCharge(input);
            toast.success(t("settings.otherChargesSavedToast"));
          }
        }}
      />

      <ConfirmDialog
        open={deletingCharge !== undefined}
        onOpenChange={(open) => !open && setDeletingCharge(undefined)}
        title={t("settings.otherChargesDeleteConfirmTitle", { name: deletingCharge ? displayName(deletingCharge) : "" })}
        description={t("settings.otherChargesDeleteConfirmDescription")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => {
          if (!deletingCharge) return;
          deleteOtherCharge(deletingCharge.id);
          toast.success(t("settings.otherChargesDeletedToast"));
          setDeletingCharge(undefined);
        }}
      />
    </Card>
  );
}
