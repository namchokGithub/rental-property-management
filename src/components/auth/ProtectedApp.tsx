import type { ReactNode } from "react";
import { useAuth } from "@/auth";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { LoginPage } from "@/features/auth/LoginPage";

interface ProtectedAppProps {
  children: ReactNode;
}

export function ProtectedApp({ children }: ProtectedAppProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <LoginPage />;
  return children;
}
