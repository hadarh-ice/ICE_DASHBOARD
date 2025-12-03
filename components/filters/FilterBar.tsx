'use client';

import { DateRangePicker } from './DateRangePicker';
import { EmployeeSelect } from './EmployeeSelect';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { DateRange } from 'react-day-picker';

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
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">טווח תאריכים</span>
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">עובדים</span>
        <EmployeeSelect
          employees={employees}
          value={selectedEmployees}
          onChange={onEmployeesChange}
        />
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="self-end"
        >
          <RotateCcw className="h-4 w-4 ml-2" />
          אפס פילטרים
        </Button>
      )}
    </div>
  );
}
