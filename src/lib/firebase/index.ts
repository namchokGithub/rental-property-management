import { app } from "@/lib/firebase/app";
import { auth } from "@/lib/firebase/auth";
import { connectFirebaseEmulators } from "@/lib/firebase/emulators";
import { db } from "@/lib/firebase/firestore";

connectFirebaseEmulators({ auth, db });

/**
 * Non-UI smoke check for code that needs to verify client initialization. It
 * performs no authentication, reads, or writes.
 */
export function assertFirebaseClientInitialized(): void {
  if (!app.name || !auth.app || !db.app) {
    throw new Error("Firebase client initialization did not complete.");
  }
}

export { app } from "@/lib/firebase/app";
export { auth } from "@/lib/firebase/auth";
export { db } from "@/lib/firebase/firestore";
export {
  getFirebaseConfigurationStatus,
  getFirebaseConfig,
  shouldUseFirebaseEmulator,
} from "@/lib/firebase/config";
