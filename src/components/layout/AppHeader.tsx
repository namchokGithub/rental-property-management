import { useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { Menu, Building2, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { ThemeMenu } from "@/components/common/ThemeMenu";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/auth";
import { useProperty } from "@/property";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-accent text-accent-foreground hover:bg-accent/80">
          <User className="h-4 w-4" />
          <span className="sr-only">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col">
          <span className="font-medium">{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
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
  const { properties, activePropertyId, setActivePropertyId } = useProperty();
  const titleKey = PAGE_TITLE_KEYS[location.pathname];
  const title = titleKey ? t(titleKey) : t("sidebar.brand");

  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3 md:flex-nowrap md:py-4 md:px-6",
      )}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-4">
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              {t("sidebar.brand")}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <NavItems onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t("header.openNavigation")}</span>
        </Button>
      </Sheet>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
        {title}
      </h1>
      {/* Forces the controls below onto their own row on narrow screens so
          the title always keeps enough width to render on one line without
          wrapping; collapses away at md+ where everything fits on one row. */}
      <div className="basis-full md:hidden" aria-hidden="true" />
      <Select
        value={activePropertyId ?? undefined}
        onValueChange={setActivePropertyId}>
        <SelectTrigger
          className="flex w-24 shrink-0 sm:w-48"
          aria-label={t("property.select")}>
          <SelectValue placeholder={t("property.select")} />
        </SelectTrigger>
        <SelectContent>
          {properties.map((property) => (
            <SelectItem key={property.id} value={property.id}>
              {property.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="shrink-0">
        <LanguageSwitch />
      </div>
      <div className="shrink-0">
        <ThemeMenu />
      </div>
      <div className="shrink-0">
        <AccountMenu />
      </div>
    </header>
  );
}
