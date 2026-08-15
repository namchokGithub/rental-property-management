import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ComponentProps } from "react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/sort";

interface SortableTableHeadProps extends ComponentProps<typeof TableHead> {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
}

export function SortableTableHead({ label, active, direction, onSort, className, ...props }: SortableTableHeadProps) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <TableHead className={cn("p-0", className)} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"} {...props}>
      <button
        type="button"
        onClick={onSort}
        className="flex h-10 w-full items-center gap-1 px-3 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", active ? "text-foreground" : "text-muted-foreground/60")} aria-hidden="true" />
      </button>
    </TableHead>
  );
}
