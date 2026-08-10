import type { AuthProvider, AuthUser } from "@/auth/auth.types";
import { InvalidCredentialsError } from "@/auth/auth.types";
import { readSession, removeSession, writeSession } from "@/auth/auth.storage";

/**
 * DEMO ONLY — this is not real authentication.
 *
 * - The credential below is a plaintext constant shipped in the frontend bundle;
 *   anyone can read it from the built JS source.
 * - There is no server verifying anything; `login()` just compares strings in
 *   the browser and writes a session object to localStorage.
 * - That localStorage session can be edited or forged by hand in devtools.
 *
 * This must be replaced by a real backend (e.g. a `FirebaseAuthService`
 * implementing the same `AuthProvider` interface) before production use.
 */
const DEMO_EMAIL = "admin@email.com";
const DEMO_PASSWORD = "admin123";
const DEMO_USER: AuthUser = {
  id: "admin-001",
  name: "Administrator",
  email: DEMO_EMAIL,
  role: "admin",
};

/** Display-only, for the demo credential hint on the login page. */
export const DEMO_CREDENTIALS_HINT = {
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class LocalAuthService implements AuthProvider {
  async login(email: string, password: string): Promise<AuthUser> {
    await delay(400);
    if (
      email.trim().toLowerCase() !== DEMO_EMAIL ||
      password !== DEMO_PASSWORD
    ) {
      throw new InvalidCredentialsError();
    }
    writeSession(DEMO_USER);
    return DEMO_USER;
  }

  async logout(): Promise<void> {
    removeSession();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return readSession();
  }
}

export const authService: AuthProvider = new LocalAuthService();
