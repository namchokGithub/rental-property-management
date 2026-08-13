import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/hooks/usePagination";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** "card" (default) is a standalone bg-card/border/shadow block, for
   * placing directly below a page's table. "bare" drops that surface for use
   * inside a component that's already its own card (e.g. a Settings section). */
  variant?: "card" | "bare";
}

export function Pagination({
  page,
  pageSize,
  totalPages,
  totalItems,
  onPageChange,
  onPageSizeChange,
  variant = "card",
}: PaginationProps) {
  const { t } = useLanguage();
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        variant === "card" ? "rounded-xl border bg-card px-4 py-3 shadow-sm" : "border-t pt-3"
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t("common.rowsPerPage")}</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{t("common.paginationRange", { from, to, total: totalItems })}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">{t("common.previousPage")}</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">{t("common.nextPage")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
