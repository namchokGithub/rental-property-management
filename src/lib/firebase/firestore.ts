import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { app } from "@/lib/firebase/app";

/**
 * Cloud Firestore client. Its persistent, multi-tab cache retains domain
 * snapshots across navigation and reloads. Every domain repository (rooms,
 * tenants, assignments, billing, settings, other charges) reads/writes
 * through this instance — there is no localStorage-backed repository left.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
