export type AuthRole = "admin" | "staff";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  /** Property memberships from the Firestore `users/{uid}` profile — the authority for access, never localStorage. */
  propertyIds: string[];
}

/**
 * Swappable authentication backend, implemented by `FirebaseAuthService`
 * (auth.service.ts) against Firebase Authentication + the Firestore
 * `users/{uid}` profile document. AuthContext, LoginPage, LoginForm,
 * ProtectedApp, and the header logout UI depend only on this interface via
 * `useAuth()`.
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
