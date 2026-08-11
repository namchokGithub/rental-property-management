import { RouterProvider } from "react-router";
import { router } from "@/app/router";
import { LanguageProvider } from "@/i18n";
import { ThemeProvider } from "@/theme";
import { AuthProvider } from "@/auth";
import { ProtectedApp } from "@/components/auth/ProtectedApp";
import { PropertyGate } from "@/components/auth/PropertyGate";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PropertyProvider } from "@/property";

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <ProtectedApp>
              <PropertyProvider>
                <PropertyGate>
                  <RouterProvider router={router} />
                </PropertyGate>
              </PropertyProvider>
            </ProtectedApp>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
