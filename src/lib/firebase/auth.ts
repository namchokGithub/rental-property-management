import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase/app";

/** Firebase Authentication client. Authentication flows remain on LocalAuthService for now. */
export const auth = getAuth(app);
