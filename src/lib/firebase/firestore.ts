import { getFirestore } from "firebase/firestore";
import { app } from "@/lib/firebase/app";

/** Cloud Firestore client. Repositories continue to use localStorage in this phase. */
export const db = getFirestore(app);
