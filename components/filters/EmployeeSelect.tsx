'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface EmployeeSelectProps {
  employees: Array<{ id: string; name: string }>;
  value: string[];
  onChange: (value: string[]) => void;
}

export function EmployeeSelect({
  employees,
  value,
  onChange,
}: EmployeeSelectProps) {
  const [open, setOpen] = React.useState(false);

  const toggleEmployee = (employeeId: string) => {
    if (value.includes(employeeId)) {
      onChange(value.filter((id) => id !== employeeId));
    } else {
      onChange([...value, employeeId]);
    }
  };

  const selectAll = () => {
    onChange(employees.map((e) => e.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedNames = employees
    .filter((e) => value.includes(e.id))
    .map((e) => e.name);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between"
        >
          <span className="truncate">
            {value.length === 0
              ? 'בחר עובדים'
              : value.length === employees.length
              ? 'כל העובדים'
              : `${value.length} עובדים נבחרו`}
          </span>
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="חפש עובד..." />
          <CommandList>
            <CommandEmpty>לא נמצאו עובדים</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={selectAll} className="cursor-pointer">
                <Check
                  className={cn(
                    'ml-2 h-4 w-4',
                    value.length === employees.length
                      ? 'opacity-100'
                      : 'opacity-0'
                  )}
                />
                בחר הכל
              </CommandItem>
              <CommandItem onSelect={clearAll} className="cursor-pointer">
                <X className="ml-2 h-4 w-4 opacity-50" />
                נקה בחירה
              </CommandItem>
            </CommandGroup>
            <CommandGroup>
              {employees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={employee.name}
                  onSelect={() => toggleEmployee(employee.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'ml-2 h-4 w-4',
                      value.includes(employee.id) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {employee.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      {value.length > 0 && value.length < employees.length && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedNames.slice(0, 3).map((name) => (
            <Badge key={name} variant="secondary" className="text-xs">
              {name}
            </Badge>
          ))}
          {selectedNames.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{selectedNames.length - 3}
            </Badge>
          )}
        </div>
      )}
    </Popover>
  );
}
