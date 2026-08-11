import { Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/auth";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import type { OtherChargeMaster } from "@/types/otherCharge";

interface OtherChargeTableProps {
  charges: OtherChargeMaster[];
  onEdit: (charge: OtherChargeMaster) => void;
  onDelete: (charge: OtherChargeMaster) => void;
  onToggleActive: (charge: OtherChargeMaster) => void;
}

export function OtherChargeTable({ charges, onEdit, onDelete, onToggleActive }: OtherChargeTableProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.name")}</TableHead>
            <TableHead>{t("settings.otherChargesDefaultAmount")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges.map((charge) => (
            <TableRow key={charge.id}>
              <TableCell className="font-medium">
                {language === "en" && charge.nameEn ? charge.nameEn : charge.nameTh}
              </TableCell>
              <TableCell>{formatCurrency(charge.defaultAmount, language)}</TableCell>
              <TableCell>
                <StatusBadge status={charge.isActive ? "active" : "inactive"} />
              </TableCell>
              <TableCell className="text-right">
                {isAdmin && (
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleActive(charge)}>
                          <Power className="h-4 w-4" />
                          <span className="sr-only">{t("common.status")}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{charge.isActive ? t("status.inactive") : t("status.active")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(charge)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">{t("common.edit")}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("common.edit")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onDelete(charge)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">{t("common.delete")}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("common.delete")}</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
