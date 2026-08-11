import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirebaseConfig } from "@/lib/firebase/config";

/** A single Firebase App instance, shared by every Firebase client service. */
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
