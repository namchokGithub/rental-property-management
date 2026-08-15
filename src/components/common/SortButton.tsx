import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/sort";

export interface SortField {
  key: string;
  label: string;
}

interface SortButtonProps {
  fields: SortField[];
  value: { key: string; direction: SortDirection };
  onApply: (value: { key: string; direction: SortDirection }) => void;
  className?: string;
}

export function SortButton({ fields, value, onApply, className }: SortButtonProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleOpenChange(next: boolean) {
    if (next) setDraft(value);
    setOpen(next);
  }

  function handleConfirm() {
    onApply(draft);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className={cn("w-full bg-card", className)}>
          <ArrowUpDown />
          {t("common.sort")}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl p-5">
        <SheetHeader>
          <SheetTitle>{t("common.sort")}</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 py-5">
          <div className="space-y-2">
            <Label>{t("common.sortBy")}</Label>
            <div className="space-y-2">
              {fields.map((field) => (
                <Button
                  key={field.key}
                  type="button"
                  variant={draft.key === field.key ? "secondary" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setDraft((current) => ({ ...current, key: field.key }))}
                >
                  {field.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("common.sortDirection")}</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant={draft.direction === "asc" ? "secondary" : "outline"} onClick={() => setDraft((current) => ({ ...current, direction: "asc" }))}>
                <ArrowUp /> {t("common.ascending")}
              </Button>
              <Button type="button" variant={draft.direction === "desc" ? "secondary" : "outline"} onClick={() => setDraft((current) => ({ ...current, direction: "desc" }))}>
                <ArrowDown /> {t("common.descending")}
              </Button>
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button className="w-full" onClick={handleConfirm}>{t("common.confirm")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
