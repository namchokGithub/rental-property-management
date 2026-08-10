import { readRaw, removeValue, writeValue } from "@/data/storage/storage";
import type { AuthSession, AuthUser } from "@/auth/auth.types";

const SESSION_KEY = "auth.session";

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    (candidate.role === "admin" || candidate.role === "staff")
  );
}

/** Reads the persisted session, discarding (and clearing) anything malformed — invalid JSON included. */
export function readSession(): AuthUser | null {
  const raw = readRaw(SESSION_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeSession();
    return null;
  }

  const session = parsed as Partial<AuthSession> | null;
  if (!session || !isAuthUser(session.user)) {
    removeSession();
    return null;
  }
  return session.user;
}

export function writeSession(user: AuthUser): void {
  writeValue<AuthSession>(SESSION_KEY, { user });
}

export function removeSession(): void {
  removeValue(SESSION_KEY);
}
