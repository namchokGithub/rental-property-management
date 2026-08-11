import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageSpinner } from "@/components/common/PageSpinner";
import { useLanguage } from "@/i18n";
import { useProperty } from "@/property";

export function PropertyGate({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { activePropertyId, isLoading } = useProperty();

  if (isLoading) return <PageSpinner />;
  if (!activePropertyId) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <EmptyState icon={Building2} title={t("property.noneTitle")} description={t("property.noneDescription")} />
      </main>
    );
  }
  return <>{children}</>;
}
