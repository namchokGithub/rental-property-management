import { useState } from "react";
import { useLocation } from "react-router";
import { Menu, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NavItems } from "@/components/layout/AppSidebar";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

const PAGE_TITLE_KEYS: Record<string, string> = {
  "/dashboard": "dashboard.title",
  "/rooms": "room.title",
  "/tenants": "tenant.title",
  "/billing": "billing.title",
  "/invoices": "invoice.title",
  "/settings": "settings.title",
};

function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      <Button
        type="button"
        size="sm"
        variant={language === "th" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLanguage("th")}
      >
        ไทย
      </Button>
      <Button
        type="button"
        size="sm"
        variant={language === "en" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
    </div>
  );
}

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();
  const titleKey = PAGE_TITLE_KEYS[location.pathname];
  const title = titleKey ? t(titleKey) : t("sidebar.brand");

  return (
    <header className={cn("flex items-center gap-3 border-b bg-background px-4 py-3 md:px-6")}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-4">
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5" />
              {t("sidebar.brand")}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <NavItems onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t("header.openNavigation")}</span>
        </Button>
      </Sheet>
      <h1 className="flex-1 text-lg font-semibold">{title}</h1>
      <LanguageSwitch />
    </header>
  );
}
