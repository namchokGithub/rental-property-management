import { RouterProvider } from "react-router";
import { router } from "@/app/router";
import { LanguageProvider } from "@/i18n";
import { AuthProvider } from "@/auth";
import { ProtectedApp } from "@/components/auth/ProtectedApp";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <ProtectedApp>
            <RouterProvider router={router} />
          </ProtectedApp>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
