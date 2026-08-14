import { createHashRouter, Navigate } from "react-router";
import { AppLayout } from "@/app/AppLayout";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { RoomsPage } from "@/features/rooms/RoomsPage";
import { TenantsPage } from "@/features/tenants/TenantsPage";
import { BillingPage } from "@/features/billing/BillingPage";
import { InvoicesPage } from "@/features/invoices/InvoicesPage";
import { InvoicePrintPage } from "@/features/invoices/InvoicePrintPage";
import { InvoiceBulkPrintPage } from "@/features/invoices/InvoiceBulkPrintPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export const router = createHashRouter(
  [
    {
      path: "/",
      element: <AppLayout />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: "dashboard", element: <DashboardPage /> },
        { path: "rooms", element: <RoomsPage /> },
        { path: "tenants", element: <TenantsPage /> },
        { path: "billing", element: <BillingPage /> },
        { path: "invoices", element: <InvoicesPage /> },
        { path: "settings", element: <SettingsPage /> },
      ],
    },
    { path: "/invoices/print", element: <InvoiceBulkPrintPage /> },
    { path: "/invoices/:id", element: <InvoicePrintPage /> },
  ],
);
