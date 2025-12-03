'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { formatNumber, formatDecimal } from '@/lib/utils/numbers';

interface KPICardProps {
  title: string;
  value: number | null;
  icon: LucideIcon;
  format?: 'number' | 'decimal' | 'rate';
  suffix?: string;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  format = 'number',
  suffix,
}: KPICardProps) {
  const displayValue =
    value === null
      ? '-'
      : format === 'decimal' || format === 'rate'
      ? formatDecimal(value)
      : formatNumber(value);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {displayValue}
          {suffix && value !== null && (
            <span className="text-sm font-normal text-muted-foreground mr-1">
              {suffix}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
