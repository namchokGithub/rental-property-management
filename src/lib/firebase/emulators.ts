import { connectAuthEmulator, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, type Functions } from "firebase/functions";
import { shouldUseFirebaseEmulator } from "@/lib/firebase/config";

const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_STATE_KEY = "__rentalFirebaseEmulatorsConnected__";

type EmulatorConnectionState = typeof globalThis & {
  __rentalFirebaseEmulatorsConnected__?: boolean;
};

interface FirebaseClients {
  auth: Auth;
  db: Firestore;
  functions: Functions;
}

/**
 * Opt-in development-only Emulator Suite wiring. The global marker survives
 * Vite HMR so the SDK is never connected to an emulator more than once.
 */
export function connectFirebaseEmulators(clients: FirebaseClients): void {
  if (!shouldUseFirebaseEmulator()) return;

  const state = globalThis as EmulatorConnectionState;
  if (state[EMULATOR_STATE_KEY]) return;

  connectAuthEmulator(clients.auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(clients.db, EMULATOR_HOST, 8080);
  connectFunctionsEmulator(clients.functions, EMULATOR_HOST, 5001);
  state[EMULATOR_STATE_KEY] = true;
}
