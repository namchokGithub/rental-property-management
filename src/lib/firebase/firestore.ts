import { getFirestore } from "firebase/firestore";
import { app } from "@/lib/firebase/app";

/** Cloud Firestore client. Every domain repository (rooms, tenants, assignments, billing, settings, other charges) reads/writes through this instance — there is no localStorage-backed repository left. */
export const db = getFirestore(app);
