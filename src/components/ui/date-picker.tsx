import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

type PickerMode = "date" | "month";

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  mode?: PickerMode;
  disabled?: boolean;
  className?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function parseValue(value: string, mode: PickerMode) {
  const parts = value.split("-").map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return undefined;
  const [year, month, day = 1] = parts;
  if (!year || !month || (mode === "date" && !day)) return undefined;
  return { year, month: month - 1, day };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatValue(year: number, month: number, day?: number) {
  return day === undefined ? `${year}-${pad(month + 1)}` : `${year}-${pad(month + 1)}-${pad(day)}`;
}

function sameDay(left: Date, right: { year: number; month: number; day: number } | undefined) {
  return Boolean(right && left.getFullYear() === right.year && left.getMonth() === right.month && left.getDate() === right.day);
}

export function DatePicker({ id, value, onChange, mode = "date", disabled, className }: DatePickerProps) {
  const { language } = useLanguage();
  const selected = parseValue(value, mode);
  const today = React.useMemo(() => new Date(), []);
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState(() => ({
    year: selected?.year ?? today.getFullYear(),
    month: selected?.month ?? today.getMonth(),
  }));
  const monthNames = language === "th" ? MONTH_NAMES_TH : MONTH_NAMES;
  const weekdays = language === "th" ? WEEKDAYS_TH : WEEKDAYS;

  React.useEffect(() => {
    if (open) setView({ year: selected?.year ?? today.getFullYear(), month: selected?.month ?? today.getMonth() });
  }, [open, selected?.year, selected?.month, today]);

  const displayValue = React.useMemo(() => {
    if (!selected) return mode === "month" ? (language === "th" ? "เลือกเดือน" : "Select month") : (language === "th" ? "เลือกวันที่" : "Select date");
    if (mode === "month") return `${monthNames[selected.month]} ${selected.year}`;
    return `${pad(selected.day)}/${pad(selected.month + 1)}/${selected.year}`;
  }, [mode, monthNames, selected]);

  const selectDate = (date: Date) => {
    onChange(formatValue(date.getFullYear(), date.getMonth(), date.getDate()));
    setOpen(false);
  };

  const selectMonth = (month: number) => {
    onChange(formatValue(view.year, month));
    setOpen(false);
  };

  const shiftMonth = (amount: number) => {
    setView((current) => {
      const target = new Date(current.year, current.month + amount, 1);
      return { year: target.getFullYear(), month: target.getMonth() };
    });
  };

  const firstDay = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const leadingDays = firstDay.getDay();
  const calendarDays = Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - leadingDays + 1;
    return new Date(view.year, view.month, day);
  });

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-xl border border-input bg-card px-3 text-left text-sm shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn(!selected && "text-muted-foreground")}>{displayValue}</span>
          <CalendarDays className="size-4 shrink-0 text-foreground" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-[60] w-[244px] rounded-none border border-border bg-popover p-3 text-popover-foreground shadow-xl outline-none"
        >
          {mode === "month" ? (
            <div>
              <div className="mb-3 flex items-center justify-between rounded-sm bg-muted px-2 py-1.5 text-xs font-medium">
                <button type="button" className="rounded p-0.5 hover:bg-background" onClick={() => setView((current) => ({ ...current, year: current.year - 1 }))} aria-label="Previous year">
                  <ChevronLeft className="size-4" />
                </button>
                <span>{view.year}</span>
                <button type="button" className="rounded p-0.5 hover:bg-background" onClick={() => setView((current) => ({ ...current, year: current.year + 1 }))} aria-label="Next year">
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {monthNames.map((monthName, month) => {
                  const isSelected = selected?.year === view.year && selected.month === month;
                  return (
                    <button key={monthName} type="button" onClick={() => selectMonth(month)} className={cn("h-8 rounded-sm text-xs font-medium transition-colors hover:bg-accent", isSelected && "bg-primary text-primary-foreground hover:bg-primary")}>{language === "th" ? monthName.slice(0, 3) : monthName.slice(0, 3)}</button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <button type="button" className="rounded p-1 hover:bg-accent" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft className="size-4" /></button>
                <span className="text-xs font-semibold">{monthNames[view.month]} {view.year}</span>
                <button type="button" className="rounded p-1 hover:bg-accent" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight className="size-4" /></button>
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {weekdays.map((weekday, index) => <span key={`${weekday}-${index}`} className="h-7 text-xs font-medium leading-7">{weekday}</span>)}
                {calendarDays.map((date) => {
                  const inCurrentMonth = date.getMonth() === view.month;
                  const isSelected = sameDay(date, selected && { ...selected, day: selected.day });
                  const isToday = sameDay(date, { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() });
                  return <button key={date.toISOString()} type="button" onClick={() => selectDate(date)} className={cn("mx-auto flex size-7 items-center justify-center rounded-sm text-xs transition-colors hover:bg-accent", !inCurrentMonth && "text-muted-foreground", isSelected && "bg-primary text-primary-foreground hover:bg-primary", !isSelected && isToday && "border border-primary text-primary")}>{date.getDate()}</button>;
                })}
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
            <button type="button" className="text-primary hover:underline" onClick={() => { onChange(""); setOpen(false); }}>{language === "th" ? "ล้าง" : "Clear"}</button>
            <button type="button" className="text-primary hover:underline" onClick={() => { mode === "month" ? onChange(formatValue(today.getFullYear(), today.getMonth())) : onChange(formatValue(today.getFullYear(), today.getMonth(), today.getDate())); setOpen(false); }}>{mode === "month" ? (language === "th" ? "เดือนนี้" : "This month") : (language === "th" ? "วันนี้" : "Today")}</button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
