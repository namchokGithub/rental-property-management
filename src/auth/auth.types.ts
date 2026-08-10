export type AuthRole = "admin" | "staff";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
}

export interface AuthSession {
  user: AuthUser;
}

/**
 * Swappable authentication backend. `LocalAuthService` (auth.service.ts) is the
 * current DEMO-ONLY implementation; a future `FirebaseAuthService` implementing
 * this same interface can replace it without changing AuthContext, LoginPage,
 * LoginForm, ProtectedApp, or the header logout UI.
 */
export interface AuthProvider {
  login(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}
