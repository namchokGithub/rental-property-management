import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import { formatDate, formatBillingMonth } from "@/lib/date";
import { resolveBillingStatus } from "@/lib/invoice";
import type { Room } from "@/types/room";
import type { Tenant } from "@/types/tenant";
import type { RoomTenantAssignment } from "@/types/assignment";
import type { BillingRecord } from "@/types/billing";

interface RoomDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: Room;
  tenant?: Tenant;
  assignment?: RoomTenantAssignment;
  billingHistory: BillingRecord[];
}

export function RoomDetailSheet({ open, onOpenChange, room, tenant, assignment, billingHistory }: RoomDetailSheetProps) {
  const { t, language } = useLanguage();
  if (!room) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {t("common.room")} {room.roomNumber}
          </SheetTitle>
          <SheetDescription>{t("room.detailDescription")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("room.roomInformation")}</h3>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("room.roomNumber")}</dt>
              <dd>{room.roomNumber}</dd>
              <dt className="text-muted-foreground">{t("room.floor")}</dt>
              <dd>{room.floor ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("room.type")}</dt>
              <dd>{room.type ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("room.monthlyRent")}</dt>
              <dd>{formatCurrency(room.monthlyRent, language)}</dd>
              <dt className="text-muted-foreground">{t("common.status")}</dt>
              <dd>
                <StatusBadge status={room.status} />
              </dd>
              {room.description && (
                <>
                  <dt className="text-muted-foreground">{t("common.notes")}</dt>
                  <dd>{room.description}</dd>
                </>
              )}
            </dl>
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("room.currentTenant")}</h3>
            {tenant && assignment ? (
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("common.name")}</dt>
                <dd>
                  {tenant.firstName} {tenant.lastName}
                </dd>
                <dt className="text-muted-foreground">{t("common.phone")}</dt>
                <dd>{tenant.phone ?? "—"}</dd>
                <dt className="text-muted-foreground">{t("room.leaseStart")}</dt>
                <dd>{formatDate(assignment.startDate, language)}</dd>
                <dt className="text-muted-foreground">{t("room.leaseEnd")}</dt>
                <dd>{assignment.endDate ? formatDate(assignment.endDate, language) : "—"}</dd>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{t("room.noTenantAssigned")}</p>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("room.utilitySettings")}</h3>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("room.electricityRate")}</dt>
              <dd>
                {formatCurrency(room.electricityRate, language)} {t("room.perUnit")}
              </dd>
              <dt className="text-muted-foreground">{t("room.waterRate")}</dt>
              <dd>
                {formatCurrency(room.waterRate, language)} {t("room.perUnit")}
              </dd>
            </dl>
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("room.billingHistory")}</h3>
            {billingHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("room.noBillingHistory")}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.month")}</TableHead>
                      <TableHead>{t("common.total")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{formatBillingMonth(record.billingMonth, language)}</TableCell>
                        <TableCell>{formatCurrency(record.total, language)}</TableCell>
                        <TableCell>
                          <StatusBadge status={resolveBillingStatus(record)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
