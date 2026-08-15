export type SortDirection = "asc" | "desc";

export function compareSortValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  direction: SortDirection,
  language: "th" | "en"
): number {
  const leftEmpty = left === null || left === undefined || left === "";
  const rightEmpty = right === null || right === undefined || right === "";

  if (leftEmpty || rightEmpty) return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1;

  const comparison =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : new Intl.Collator(language === "th" ? "th-TH" : "en", { numeric: true, sensitivity: "base" }).compare(
          String(left),
          String(right)
        );

  return direction === "asc" ? comparison : -comparison;
}
