import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useLanguage } from "@/i18n";
import { formatDate } from "@/lib/date";
import type { Tenant } from "@/types/tenant";
import type { Room } from "@/types/room";
import type { RoomTenantAssignment } from "@/types/assignment";

interface TenantDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: Tenant;
  currentRoom?: Room;
  assignment?: RoomTenantAssignment;
}

export function TenantDetailSheet({ open, onOpenChange, tenant, currentRoom, assignment }: TenantDetailSheetProps) {
  const { t, language } = useLanguage();
  if (!tenant) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {tenant.name}
          </SheetTitle>
          <SheetDescription>{t("tenant.detailDescription")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("tenant.contact")}</h3>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("common.phone")}</dt>
              <dd>{tenant.phone ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("common.email")}</dt>
              <dd>{tenant.email ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("tenant.identificationNumber")}</dt>
              <dd>{tenant.identificationNumber ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("common.address")}</dt>
              <dd>{tenant.address ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("common.status")}</dt>
              <dd>
                <StatusBadge status={tenant.status} />
              </dd>
            </dl>
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("tenant.emergencyContact")}</h3>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("common.name")}</dt>
              <dd>{tenant.emergencyContactName ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("common.phone")}</dt>
              <dd>{tenant.emergencyContactPhone ?? "—"}</dd>
            </dl>
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("tenant.leaseInformation")}</h3>
            {currentRoom && assignment ? (
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("tenant.currentRoom")}</dt>
                <dd>{currentRoom.roomNumber}</dd>
                <dt className="text-muted-foreground">{t("room.leaseStart")}</dt>
                <dd>{formatDate(assignment.startDate, language)}</dd>
                <dt className="text-muted-foreground">{t("room.leaseEnd")}</dt>
                <dd>{assignment.endDate ? formatDate(assignment.endDate, language) : "—"}</dd>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{t("tenant.notAssigned")}</p>
            )}
          </section>

          {tenant.notes && (
            <>
              <Separator />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">{t("common.notes")}</h3>
                <p className="text-sm">{tenant.notes}</p>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
