import { getFunctions } from "firebase/functions";
import { app } from "@/lib/firebase/app";
import { getFirebaseFunctionsRegion } from "@/lib/firebase/config";

/** Cloud Functions client. No callable functions are invoked in this phase. */
export const functions = getFunctions(app, getFirebaseFunctionsRegion());
