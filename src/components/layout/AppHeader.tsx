import { useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { Menu, Building2, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavItems } from "@/components/layout/AppSidebar";
import { LanguageSwitch } from "@/components/common/LanguageSwitch";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/auth";
import { cn } from "@/lib/utils";

const PAGE_TITLE_KEYS: Record<string, string> = {
  "/dashboard": "dashboard.title",
  "/rooms": "room.title",
  "/tenants": "tenant.title",
  "/billing": "billing.title",
  "/invoices": "invoice.title",
  "/settings": "settings.title",
};

function AccountMenu() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    toast.success(t("auth.logoutSuccess"));
  }

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <User className="h-4 w-4" />
          <span className="sr-only">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col">
          <span className="font-medium">{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
      <AccountMenu />
    </header>
  );
}
