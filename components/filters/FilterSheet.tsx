'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Calendar, Users, RotateCcw, ChevronLeft } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Sheet, SheetFooter, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { DateRangeModal } from './DateRangeModal';
import { EmployeeSelectModal } from './EmployeeSelectModal';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
}

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  dateRange: DateRange | undefined;
  selectedEmployees: string[];
  onDateRangeChange: (range: DateRange | undefined) => void;
  onEmployeesChange: (employees: string[]) => void;
  onReset: () => void;
}

export function FilterSheet({
  isOpen,
  onClose,
  employees,
  dateRange,
  selectedEmployees,
  onDateRangeChange,
  onEmployeesChange,
  onReset,
}: FilterSheetProps) {
  const [showDateModal, setShowDateModal] = React.useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = React.useState(false);

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'כל התאריכים';
    if (!range.to) return format(range.from, 'dd/MM/yyyy', { locale: he });
    return `${format(range.from, 'dd/MM', { locale: he })} - ${format(range.to, 'dd/MM', { locale: he })}`;
  };

  const formatEmployeeSelection = () => {
    if (selectedEmployees.length === 0) return 'כל העובדים';
    if (selectedEmployees.length === 1) {
      const emp = employees.find((e) => e.id === selectedEmployees[0]);
      return emp?.name || '1 עובד';
    }
    return `${selectedEmployees.length} עובדים`;
  };

  const hasFilters = dateRange?.from || selectedEmployees.length > 0;

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title="סינון"
        height="auto"
      >
        <SheetContent className="space-y-4">
          {/* Date Range Filter */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowDateModal(true)}
            className={cn(
              'w-full flex items-center justify-between',
              'p-4 rounded-xl',
              'bg-gray-50 dark:bg-gray-800/50',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">טווח תאריכים</p>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {formatDateRange(dateRange)}
                </p>
              </div>
            </div>
            <ChevronLeft className="h-5 w-5 text-gray-400" />
          </motion.button>

          {/* Employee Filter */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowEmployeeModal(true)}
            className={cn(
              'w-full flex items-center justify-between',
              'p-4 rounded-xl',
              'bg-gray-50 dark:bg-gray-800/50',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">עובדים</p>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {formatEmployeeSelection()}
                </p>
              </div>
            </div>
            <ChevronLeft className="h-5 w-5 text-gray-400" />
          </motion.button>

          {/* Reset Button */}
          {hasFilters && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={onReset}
              className={cn(
                'w-full flex items-center justify-center gap-2',
                'py-3 rounded-xl',
                'text-red-500 dark:text-red-400',
                'hover:bg-red-50 dark:hover:bg-red-900/20',
                'transition-colors'
              )}
            >
              <RotateCcw className="h-4 w-4" />
              <span className="font-medium">אפס פילטרים</span>
            </motion.button>
          )}
        </SheetContent>

        <SheetFooter>
          <Button
            className="flex-1 h-12 rounded-xl text-base"
            onClick={onClose}
          >
            החל סינון
          </Button>
        </SheetFooter>
      </Sheet>

      {/* Nested Modals */}
      <DateRangeModal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        value={dateRange}
        onChange={onDateRangeChange}
      />

      <EmployeeSelectModal
        isOpen={showEmployeeModal}
        onClose={() => setShowEmployeeModal(false)}
        employees={employees}
        value={selectedEmployees}
        onChange={onEmployeesChange}
      />
    </>
  );
}

// Filter Trigger Button Component
interface FilterTriggerProps {
  onClick: () => void;
  hasActiveFilters?: boolean;
  dateRange?: DateRange;
  employeeCount?: number;
}

export function FilterTrigger({
  onClick,
  hasActiveFilters,
  dateRange,
  employeeCount = 0,
}: FilterTriggerProps) {
  const formatSummary = () => {
    const parts: string[] = [];
    if (dateRange?.from) {
      parts.push(format(dateRange.from, 'dd/MM', { locale: he }));
    }
    if (employeeCount > 0) {
      parts.push(`${employeeCount} עובדים`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'סינון';
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2',
        'px-4 py-2.5 rounded-xl',
        'text-sm font-medium',
        'transition-colors',
        hasActiveFilters
          ? 'bg-primary/10 text-primary'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
      )}
    >
      <Calendar className="h-4 w-4" />
      <span>{formatSummary()}</span>
      {hasActiveFilters && (
        <span className="w-2 h-2 rounded-full bg-primary" />
      )}
    </motion.button>
  );
}
