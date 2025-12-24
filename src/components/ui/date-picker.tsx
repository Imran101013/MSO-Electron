import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { YearPicker } from "@/components/ui/year-picker";

interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"calendar" | "year">("calendar");
  const [selectedYear, setSelectedYear] = React.useState<number | undefined>(
    date instanceof Date ? date.getFullYear() : undefined
  );

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setView("calendar");
    // Set the date to January 1st of the selected year
    const newDate = new Date(year, 0, 1);
    onDateChange?.(newDate);
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    onDateChange?.(selectedDate);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span
            className="cursor-pointer underline"
            onClick={(e) => {
              e.stopPropagation();
              setView("year");
              setOpen(true);
            }}>
            {date ? format(date, "PPP") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        {view === "year" ? (
          <YearPicker
            selectedYear={selectedYear}
            onYearSelect={handleYearSelect}
          />
        ) : (
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
