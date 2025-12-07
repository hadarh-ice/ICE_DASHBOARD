'use client';

import * as React from 'react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { motion } from 'framer-motion';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}

const presets = [
  {
    label: 'היום',
    getValue: () => ({
      from: new Date(),
      to: new Date(),
    }),
  },
  {
    label: '7 ימים אחרונים',
    getValue: () => ({
      from: subDays(new Date(), 7),
      to: new Date(),
    }),
  },
  {
    label: '30 ימים אחרונים',
    getValue: () => ({
      from: subDays(new Date(), 30),
      to: new Date(),
    }),
  },
  {
    label: 'החודש הנוכחי',
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: new Date(),
    }),
  },
  {
    label: 'החודש הקודם',
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
];

export function DateRangeModal({
  isOpen,
  onClose,
  value,
  onChange,
}: DateRangeModalProps) {
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(value);

  // Sync temp with actual value when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTempRange(value);
    }
  }, [isOpen, value]);

  const handleApply = () => {
    onChange(tempRange);
    onClose();
  };

  const handleCancel = () => {
    setTempRange(value);
    onClose();
  };

  const handlePresetClick = (preset: typeof presets[0]) => {
    setTempRange(preset.getValue());
  };

  const formatDisplayRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'בחר תאריכים';
    if (!range.to) return format(range.from, 'dd/MM/yyyy', { locale: he });
    return `${format(range.from, 'dd/MM/yyyy', { locale: he })} - ${format(range.to, 'dd/MM/yyyy', { locale: he })}`;
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleCancel}
      title="בחר טווח תאריכים"
      height="full"
    >
      <div className="flex flex-col h-full">
        {/* Selected Range Display */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">טווח נבחר:</p>
          <p className="text-base font-medium text-gray-900 dark:text-white">
            {formatDisplayRange(tempRange)}
          </p>
        </div>

        {/* Quick Presets */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            בחירה מהירה
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <motion.button
                key={preset.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  'bg-gray-100 dark:bg-gray-800',
                  'text-gray-700 dark:text-gray-300',
                  'hover:bg-primary/10 hover:text-primary',
                  'active:bg-primary/20'
                )}
              >
                {preset.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-y-auto px-2 py-4 flex justify-center">
          <Calendar
            mode="range"
            defaultMonth={tempRange?.from || new Date()}
            selected={tempRange}
            onSelect={setTempRange}
            numberOfMonths={1}
            locale={he}
            dir="rtl"
            className="rounded-xl"
            classNames={{
              months: 'flex flex-col',
              month: 'space-y-4',
              caption: 'flex justify-center pt-1 relative items-center',
              caption_label: 'text-base font-semibold',
              nav: 'space-x-1 flex items-center',
              nav_button: cn(
                'h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100',
                'inline-flex items-center justify-center rounded-full',
                'hover:bg-gray-100 dark:hover:bg-gray-800'
              ),
              nav_button_previous: 'absolute left-1',
              nav_button_next: 'absolute right-1',
              table: 'w-full border-collapse space-y-1',
              head_row: 'flex',
              head_cell: cn(
                'text-gray-500 rounded-md w-10 font-medium text-[13px]',
                'flex items-center justify-center'
              ),
              row: 'flex w-full mt-1',
              cell: cn(
                'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
                '[&:has([aria-selected])]:bg-primary/10',
                '[&:has([aria-selected].day-range-end)]:rounded-l-full',
                '[&:has([aria-selected].day-range-start)]:rounded-r-full',
                'first:[&:has([aria-selected])]:rounded-r-full',
                'last:[&:has([aria-selected])]:rounded-l-full'
              ),
              day: cn(
                'h-10 w-10 p-0 font-normal',
                'inline-flex items-center justify-center rounded-full',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                'aria-selected:opacity-100'
              ),
              day_range_start: 'day-range-start bg-primary text-white hover:bg-primary',
              day_range_end: 'day-range-end bg-primary text-white hover:bg-primary',
              day_selected: 'bg-primary text-white hover:bg-primary focus:bg-primary',
              day_today: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white',
              day_outside: 'text-gray-300 dark:text-gray-600 opacity-50',
              day_disabled: 'text-gray-300 dark:text-gray-600 opacity-50',
              day_range_middle: 'aria-selected:bg-primary/10 aria-selected:text-gray-900 dark:aria-selected:text-white',
              day_hidden: 'invisible',
            }}
          />
        </div>

        {/* Action Buttons */}
        <SheetFooter>
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl text-base"
            onClick={handleCancel}
          >
            ביטול
          </Button>
          <Button
            className="flex-1 h-12 rounded-xl text-base"
            onClick={handleApply}
          >
            אישור
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}
