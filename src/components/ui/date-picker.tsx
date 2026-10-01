import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  /** yyyy-MM-dd: this day and every earlier one are greyed out (e.g. the paper-registers cut-over). */
  disabledThrough?: string | null;
}

export function DatePicker({ date, onDateChange, placeholder = "Pick a date", className, disabledThrough }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const firstOpenDay = React.useMemo(() => {
    if (!disabledThrough) return undefined;
    const [y, m, d] = disabledThrough.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d + 1);
  }, [disabledThrough]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground", className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { onDateChange?.(d); setOpen(false); }}
          defaultMonth={date ?? new Date()}
          disabled={firstOpenDay ? { before: firstOpenDay } : undefined}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
