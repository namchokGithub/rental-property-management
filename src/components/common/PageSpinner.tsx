import { LoaderCircle } from "lucide-react";

/**
 * In-page loading placeholder for data that now loads asynchronously from
 * Firestore (`onSnapshot`) instead of synchronously from localStorage. Pages
 * render this while their primary document/collection subscription has not
 * yet delivered a first snapshot.
 */
export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
