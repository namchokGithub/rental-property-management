import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/i18n";

export interface FilterFieldOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  options: FilterFieldOption[];
}

interface FilterButtonProps {
  fields: FilterField[];
  values: Record<string, string>;
  onApply: (values: Record<string, string>) => void;
}

export function FilterButton({ fields, values, onApply }: FilterButtonProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(values);

  const activeCount = fields.filter((field) => values[field.key] && values[field.key] !== "all").length;

  function handleOpenChange(next: boolean) {
    if (next) setDraft(values);
    setOpen(next);
  }

  function handleClear() {
    const cleared: Record<string, string> = {};
    fields.forEach((field) => {
      cleared[field.key] = "all";
    });
    setDraft(cleared);
  }

  function handleConfirm() {
    onApply(draft);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative w-full shrink-0 sm:w-auto">
          <Filter />
          {t("common.filter")}
          {activeCount > 0 && (
            <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full px-1">
              {activeCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("common.filter")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label>{field.label}</Label>
              <Select
                value={draft[field.key] ?? "all"}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClear}>
            {t("common.clearFilters")}
          </Button>
          <Button onClick={handleConfirm}>{t("common.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
