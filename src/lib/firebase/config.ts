import type { FirebaseOptions } from "firebase/app";

const REQUIRED_VARIABLES = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

type RequiredFirebaseVariable = (typeof REQUIRED_VARIABLES)[number];

interface FirebaseEnvironmentValues {
  VITE_FIREBASE_API_KEY: string;
  VITE_FIREBASE_AUTH_DOMAIN: string;
  VITE_FIREBASE_PROJECT_ID: string;
  VITE_FIREBASE_STORAGE_BUCKET: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  VITE_FIREBASE_APP_ID: string;
}

export interface FirebaseConfigurationStatus {
  isConfigured: boolean;
  missingVariables: RequiredFirebaseVariable[];
}

function readRequiredEnvironment(): FirebaseEnvironmentValues {
  return {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? "",
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? "",
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "",
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? "",
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? "",
  };
}

export function getFirebaseConfigurationStatus(): FirebaseConfigurationStatus {
  const environment = readRequiredEnvironment();
  const missingVariables = REQUIRED_VARIABLES.filter((name) => !environment[name]);
  return { isConfigured: missingVariables.length === 0, missingVariables };
}

/** Returns validated public Firebase Web App configuration without logging its values. */
export function getFirebaseConfig(): FirebaseOptions {
  const status = getFirebaseConfigurationStatus();
  if (!status.isConfigured) {
    throw new Error(
      `Firebase is not configured. Add ${status.missingVariables.join(", ")} to .env.local ` +
        "(see .env.example and docs/firebase/setup.md)."
    );
  }

  const environment = readRequiredEnvironment();
  return {
    apiKey: environment.VITE_FIREBASE_API_KEY,
    authDomain: environment.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: environment.VITE_FIREBASE_PROJECT_ID,
    storageBucket: environment.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: environment.VITE_FIREBASE_APP_ID,
  };
}

export function getFirebaseFunctionsRegion(): string {
  return import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION?.trim() || "us-central1";
}

export function shouldUseFirebaseEmulator(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";
}
