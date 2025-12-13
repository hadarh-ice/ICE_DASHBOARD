'use client';

import { DateRangePicker } from './DateRangePicker';
import { EmployeeSelect } from './EmployeeSelect';
import { Button } from '@/components/ui/button';
import { RotateCcw, Calendar, Users } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  employees: Array<{ id: string; name: string }>;
  dateRange: DateRange | undefined;
  selectedEmployees: string[];
  onDateRangeChange: (range: DateRange | undefined) => void;
  onEmployeesChange: (employees: string[]) => void;
  onReset: () => void;
}

export function FilterBar({
  employees,
  dateRange,
  selectedEmployees,
  onDateRangeChange,
  onEmployeesChange,
  onReset,
}: FilterBarProps) {
  const hasFilters = dateRange?.from || selectedEmployees.length > 0;

  return (
    <div
      className={cn(
        "sticky top-0 z-10",
        "bg-background/95 backdrop-blur-sm",
        "border-b border-border/40",
        "transition-shadow duration-200",
        "shadow-sm"
      )}
    >
      <div className="flex flex-wrap items-end gap-6 px-6 py-4">
        {/* Date Range Filter */}
        <div className="flex flex-col gap-2 min-w-[240px]">
          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>טווח תאריכים</span>
          </label>
          <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
        </div>

        {/* Employee Filter */}
        <div className="flex flex-col gap-2 min-w-[240px]">
          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>עובדים</span>
          </label>
          <EmployeeSelect
            employees={employees}
            value={selectedEmployees}
            onChange={onEmployeesChange}
          />
        </div>

        {/* Reset Button */}
        {hasFilters && (
          <Button
            variant="outline"
            size="default"
            onClick={onReset}
            className={cn(
              "gap-2 mb-0.5",
              "text-destructive border-destructive/30",
              "hover:bg-destructive/10 hover:text-destructive",
              "transition-all duration-200"
            )}
          >
            <RotateCcw className="h-4 w-4" />
            <span>אפס פילטרים</span>
          </Button>
        )}
      </div>
    </div>
  );
}
