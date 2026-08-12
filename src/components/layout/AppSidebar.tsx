import { NavLink } from "react-router";
import {
  LayoutDashboard,
  DoorOpen,
  Users,
  Receipt,
  FileText,
  Settings,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";

const NAV_ITEMS = [
  { to: "/dashboard", labelKey: "sidebar.dashboard", icon: LayoutDashboard },
  { to: "/rooms", labelKey: "sidebar.rooms", icon: DoorOpen },
  { to: "/tenants", labelKey: "sidebar.tenants", icon: Users },
  { to: "/billing", labelKey: "sidebar.billing", icon: Receipt },
  { to: "/invoices", labelKey: "sidebar.invoices", icon: FileText },
  { to: "/settings", labelKey: "sidebar.settings", icon: Settings },
] as const;

interface NavItemsProps {
  onNavigate?: () => void;
}

export function NavItems({ onNavigate }: NavItemsProps) {
  const { t } = useLanguage();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )
          }>
          <item.icon className="h-4 w-4" />
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppSidebar() {
  const { t } = useLanguage();
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-card">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" />
        </span>
        <span className="font-semibold tracking-tight">
          {t("sidebar.brand")}
        </span>
      </div>
      <div className="flex-1 space-y-1 px-3">
        <NavItems />
      </div>
    </aside>
  );
}
