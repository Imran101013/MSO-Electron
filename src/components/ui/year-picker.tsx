import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface YearPickerProps {
  selectedYear?: number;
  onYearSelect: (year: number) => void;
  className?: string;
}

export function YearPicker({
  selectedYear,
  onYearSelect,
  className,
}: YearPickerProps) {
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = React.useState(
    selectedYear
      ? Math.floor(selectedYear / 12) * 12
      : Math.floor(currentYear / 12) * 12
  );

  const years = Array.from({ length: 12 }, (_, i) => startYear + i);

  const handlePrev = () => setStartYear(startYear - 12);
  const handleNext = () => setStartYear(startYear + 12);

  return (
    <div className={cn("p-3", className)}>
      <div className="flex justify-between items-center mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          className="h-7 w-7 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {startYear} - {startYear + 11}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          className="h-7 w-7 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {years.map((year) => (
          <Button
            key={year}
            variant={selectedYear === year ? "default" : "ghost"}
            className="h-9 w-full"
            onClick={() => onYearSelect(year)}>
            {year}
          </Button>
        ))}
      </div>
    </div>
  );
}
