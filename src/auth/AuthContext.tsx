import { onAuthStateChanged } from "firebase/auth";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { authService, fetchUserProfile } from "@/auth/auth.service";
import type { AuthUser } from "@/auth/auth.types";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadedUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        loadedUidRef.current = null;
        setUser(null);
        setIsLoading(false);
        return;
      }
      if (loadedUidRef.current === firebaseUser.uid) {
        setIsLoading(false);
        return;
      }
      const profile = await fetchUserProfile(firebaseUser.uid);
      loadedUidRef.current = firebaseUser.uid;
      setUser(profile);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  async function login(email: string, password: string) {
    const profile = await authService.login(email, password);
    loadedUidRef.current = profile.id;
    setUser(profile);
  }

  function logout() {
    setUser(null);
    loadedUidRef.current = null;
    void authService.logout();
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
