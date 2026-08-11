import {
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { AuthProvider, AuthUser } from "@/auth/auth.types";
import { InvalidCredentialsError } from "@/auth/auth.types";

const INVALID_CREDENTIAL_CODES = new Set([
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-email",
]);

interface UserProfileDoc {
  name: string;
  email: string;
  role: "admin" | "staff";
  propertyIds: string[];
  isActive: boolean;
}

export async function fetchUserProfile(uid: string): Promise<AuthUser | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as UserProfileDoc;
  if (!data.isActive) return null;
  return {
    id: uid,
    name: data.name,
    email: data.email,
    role: data.role,
    propertyIds: data.propertyIds,
  };
}

class FirebaseAuthService implements AuthProvider {
  async login(email: string, password: string): Promise<AuthUser> {
    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        INVALID_CREDENTIAL_CODES.has((error as { code: string }).code)
      ) {
        throw new InvalidCredentialsError();
      }
      throw error;
    }
    const profile = await fetchUserProfile(credential.user.uid);
    if (!profile) {
      await signOut(auth);
      throw new InvalidCredentialsError();
    }
    return profile;
  }

  async logout(): Promise<void> {
    await signOut(auth);
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const current: FirebaseUser | null = auth.currentUser;
    if (!current) return null;
    return fetchUserProfile(current.uid);
  }
}

export const authService: AuthProvider = new FirebaseAuthService();
