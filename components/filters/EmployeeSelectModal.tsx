'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Search, Check, Users } from 'lucide-react';
import { Sheet, SheetFooter, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
}

interface EmployeeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  value: string[];
  onChange: (selected: string[]) => void;
}

export function EmployeeSelectModal({
  isOpen,
  onClose,
  employees,
  value,
  onChange,
}: EmployeeSelectModalProps) {
  const [tempSelected, setTempSelected] = React.useState<string[]>(value);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Sync temp with actual value when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTempSelected(value);
      setSearchQuery('');
    }
  }, [isOpen, value]);

  const filteredEmployees = React.useMemo(() => {
    if (!searchQuery.trim()) return employees;
    return employees.filter((emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  const handleToggle = (id: string) => {
    setTempSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setTempSelected(filteredEmployees.map((e) => e.id));
  };

  const handleClearAll = () => {
    setTempSelected([]);
  };

  const handleApply = () => {
    onChange(tempSelected);
    onClose();
  };

  const handleCancel = () => {
    setTempSelected(value);
    onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleCancel}
      title="בחר עובדים"
      height="full"
    >
      <div className="flex flex-col h-full">
        {/* Search Input */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש עובד..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full h-10 pr-10 pl-4 rounded-xl',
                'bg-gray-100 dark:bg-gray-800',
                'border-0 outline-none',
                'text-gray-900 dark:text-white',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'text-base'
              )}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            <span>{tempSelected.length} נבחרו</span>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSelectAll}
              className="text-sm text-primary font-medium px-2 py-1 rounded-lg hover:bg-primary/10"
            >
              בחר הכל
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleClearAll}
              className="text-sm text-gray-500 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              נקה
            </motion.button>
          </div>
        </div>

        {/* Employee List */}
        <div className="flex-1 overflow-y-auto">
          {filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <Users className="h-8 w-8 mb-2" />
              <p className="text-sm">לא נמצאו עובדים</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredEmployees.map((employee, index) => {
                const isSelected = tempSelected.includes(employee.id);
                return (
                  <motion.button
                    key={employee.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleToggle(employee.id)}
                    className={cn(
                      'w-full flex items-center justify-between',
                      'px-4 py-3',
                      'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      'active:bg-gray-100 dark:active:bg-gray-800',
                      'transition-colors'
                    )}
                  >
                    <span className={cn(
                      'text-base',
                      isSelected
                        ? 'text-primary font-medium'
                        : 'text-gray-900 dark:text-white'
                    )}>
                      {employee.name}
                    </span>
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-primary text-white'
                          : 'border-2 border-gray-300 dark:border-gray-600'
                      )}
                    >
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
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
            אישור ({tempSelected.length})
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}
