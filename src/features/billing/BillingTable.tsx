import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/auth";
import { useLanguage } from "@/i18n";
import { formatAmount, formatCurrency } from "@/lib/currency";
import { formatBillingMonth } from "@/lib/date";
import { resolveBillingStatus } from "@/lib/invoice";
import type { BillingRecord } from "@/types/billing";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";
import type { Language } from "@/i18n/types";

interface BillingTableProps {
  records: BillingRecord[];
  roomById: Record<string, Room>;
  tenantById: Record<string, Tenant>;
  onEdit: (record: BillingRecord) => void;
  onDelete: (record: BillingRecord) => void;
  onIssue: (record: BillingRecord) => void;
  onMarkPaid: (record: BillingRecord) => void;
  selectedIds: Set<string>;
  onToggleRecord: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
}

function ActionsMenu({
  record,
  onEdit,
  onDelete,
  onIssue,
  onMarkPaid,
  t,
}: Pick<BillingTableProps, "onEdit" | "onDelete" | "onIssue" | "onMarkPaid"> & {
  record: BillingRecord;
  t: (key: string) => string;
}) {
  const status = resolveBillingStatus(record);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  if (!isAdmin) return null;
  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(record)}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{t("common.edit")}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("common.edit")}</TooltipContent>
      </Tooltip>
      {record.status === "draft" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onIssue(record)}>
              <Send className="h-4 w-4" />
              <span className="sr-only">{t("common.issue")}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("common.issue")}</TooltipContent>
        </Tooltip>
      )}
      {(status === "issued" || status === "overdue") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMarkPaid(record)}>
              <CheckCircle2 className="h-4 w-4" />
              <span className="sr-only">{t("common.markAsPaid")}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("common.markAsPaid")}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(record)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{t("common.delete")}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("common.delete")}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function BillingCard({
  record,
  roomById,
  tenantById,
  onEdit,
  onDelete,
  onIssue,
  onMarkPaid,
  selectedIds,
  onToggleRecord,
  t,
  language,
}: BillingTableProps & { record: BillingRecord; t: (key: string, params?: Record<string, string | number>) => string; language: Language }) {
  const [expanded, setExpanded] = useState(false);
  const room = roomById[record.roomId];
  const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Checkbox
              className="mt-1"
              checked={selectedIds.has(record.id)}
              onCheckedChange={() => onToggleRecord(record.id)}
              disabled={record.status !== "draft"}
              aria-label={t("common.selectRow")}
            />
            <div>
              <p className="font-medium">
                {t("common.room")} {room?.roomNumber ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("billing.mobileCardSubtitle", {
                  tenant: tenant ? tenant.name : t("common.noTenant"),
                  month: formatBillingMonth(record.billingMonth, language),
                })}
              </p>
            </div>
          </div>
          <ActionsMenu record={record} onEdit={onEdit} onDelete={onDelete} onIssue={onIssue} onMarkPaid={onMarkPaid} t={t} />
        </div>
        <div className="flex items-center justify-between">
          <StatusBadge status={resolveBillingStatus(record)} />
          <p className="text-lg font-semibold">{formatCurrency(record.total, language)}</p>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-between" onClick={() => setExpanded(!expanded)}>
          {t("billing.details")} {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {expanded && (
          <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
            <p>
              {t("billing.electricityDetailLine", {
                usage: record.electricity.usage,
                rate: formatCurrency(record.electricity.rate, language),
                amount: formatCurrency(record.electricity.amount, language),
              })}
            </p>
            <p>
              {t("billing.waterDetailLine", {
                usage: record.water.usage,
                rate: formatCurrency(record.water.rate, language),
                amount: formatCurrency(record.water.amount, language),
              })}
            </p>
            <p>{t("billing.rentDetailLine", { amount: formatCurrency(record.rentAmount, language) })}</p>
            {record.otherCharges.map((charge) => (
              <p key={charge.id}>
                {t("billing.otherChargeDetailLine", { name: charge.name, amount: formatCurrency(charge.amount, language) })}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BillingTable({
  records,
  roomById,
  tenantById,
  onEdit,
  onDelete,
  onIssue,
  onMarkPaid,
  selectedIds,
  onToggleRecord,
  onToggleAll,
}: BillingTableProps) {
  const { t, language } = useLanguage();
  const selectableIds = records.filter((r) => r.status === "draft").map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && selectableIds.some((id) => selectedIds.has(id));

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="sticky left-0 z-10 w-10 min-w-10 bg-muted align-middle">
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={() => onToggleAll(selectableIds)}
                  disabled={selectableIds.length === 0}
                  aria-label={t("common.selectAll")}
                />
              </TableHead>
              <TableHead rowSpan={2} className="sticky left-10 z-10 w-24 min-w-24 bg-muted align-middle">
                {t("common.room")}
              </TableHead>
              <TableHead rowSpan={2} className="sticky left-[8.5rem] z-10 w-36 min-w-36 bg-muted align-middle">
                {t("common.tenant")}
              </TableHead>
              <TableHead rowSpan={2} className="align-middle">{t("billing.invoiceNumber")}</TableHead>
              <TableHead rowSpan={2} className="align-middle">{t("common.month")}</TableHead>
              <TableHead colSpan={5} className="border-l text-center">
                {t("billing.electricityGroup")}
              </TableHead>
              <TableHead colSpan={5} className="border-l text-center">
                {t("billing.waterGroup")}
              </TableHead>
              <TableHead rowSpan={2} className="align-middle">{t("billing.rent")}</TableHead>
              <TableHead rowSpan={2} className="align-middle">{t("common.total")}</TableHead>
              <TableHead rowSpan={2} className="align-middle">{t("common.status")}</TableHead>
              <TableHead rowSpan={2} className="sticky right-0 z-10 w-40 min-w-40 bg-muted text-right align-middle">
                {t("common.actions")}
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="border-l">{t("billing.meterPrev")}</TableHead>
              <TableHead>{t("billing.meterCur")}</TableHead>
              <TableHead>{t("billing.meterUsage")}</TableHead>
              <TableHead>{t("billing.meterRate")}</TableHead>
              <TableHead>{t("billing.meterAmount")}</TableHead>
              <TableHead className="border-l">{t("billing.meterPrev")}</TableHead>
              <TableHead>{t("billing.meterCur")}</TableHead>
              <TableHead>{t("billing.meterUsage")}</TableHead>
              <TableHead>{t("billing.meterRate")}</TableHead>
              <TableHead>{t("billing.meterAmount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => {
              const room = roomById[record.roomId];
              const tenant = record.tenantId ? tenantById[record.tenantId] : undefined;
              return (
                <TableRow key={record.id} data-state={selectedIds.has(record.id) ? "selected" : undefined}>
                  <TableCell className="sticky left-0 z-10 w-10 min-w-10 bg-card">
                    <Checkbox
                      checked={selectedIds.has(record.id)}
                      onCheckedChange={() => onToggleRecord(record.id)}
                      disabled={record.status !== "draft"}
                      aria-label={t("common.selectRow")}
                    />
                  </TableCell>
                  <TableCell className="sticky left-10 z-10 w-24 min-w-24 bg-card font-medium">
                    {room?.roomNumber ?? "—"}
                  </TableCell>
                  <TableCell className="sticky left-[8.5rem] z-10 w-36 min-w-36 bg-card">
                    {tenant ? tenant.name : "—"}
                  </TableCell>
                  <TableCell>{record.invoiceNumber ?? "—"}</TableCell>
                  <TableCell>{formatBillingMonth(record.billingMonth, language)}</TableCell>
                  <TableCell>{record.electricity.previousMeter}</TableCell>
                  <TableCell>{record.electricity.currentMeter}</TableCell>
                  <TableCell>{record.electricity.usage}</TableCell>
                  <TableCell>{formatAmount(record.electricity.rate, language)}</TableCell>
                  <TableCell>{formatAmount(record.electricity.amount, language)}</TableCell>
                  <TableCell>{record.water.previousMeter}</TableCell>
                  <TableCell>{record.water.currentMeter}</TableCell>
                  <TableCell>{record.water.usage}</TableCell>
                  <TableCell>{formatAmount(record.water.rate, language)}</TableCell>
                  <TableCell>{formatAmount(record.water.amount, language)}</TableCell>
                  <TableCell>{formatAmount(record.rentAmount, language)}</TableCell>
                  <TableCell className="font-medium">{formatAmount(record.total, language)}</TableCell>
                  <TableCell>
                    <StatusBadge status={resolveBillingStatus(record)} />
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 w-40 min-w-40 bg-card text-right">
                    <ActionsMenu record={record} onEdit={onEdit} onDelete={onDelete} onIssue={onIssue} onMarkPaid={onMarkPaid} t={t} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {records.map((record) => (
          <BillingCard
            key={record.id}
            record={record}
            records={records}
            roomById={roomById}
            tenantById={tenantById}
            onEdit={onEdit}
            onDelete={onDelete}
            onIssue={onIssue}
            onMarkPaid={onMarkPaid}
            selectedIds={selectedIds}
            onToggleRecord={onToggleRecord}
            onToggleAll={onToggleAll}
            t={t}
            language={language}
          />
        ))}
      </div>
    </>
  );
}
