'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { formatNumber, formatDecimal } from '@/lib/utils/numbers';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number | null;
  icon: LucideIcon;
  format?: 'number' | 'decimal' | 'rate';
  suffix?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

const colorMap = {
  blue: {
    bg: 'bg-blue-500/10',
    icon: 'text-blue-600',
    gradient: 'from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10',
  },
  green: {
    bg: 'bg-green-500/10',
    icon: 'text-green-600',
    gradient: 'from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10',
  },
  purple: {
    bg: 'bg-purple-500/10',
    icon: 'text-purple-600',
    gradient: 'from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10',
  },
  orange: {
    bg: 'bg-orange-500/10',
    icon: 'text-orange-600',
    gradient: 'from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10',
  },
};

export function KPICard({
  title,
  value,
  icon: Icon,
  format = 'number',
  suffix,
  color = 'blue',
}: KPICardProps) {
  const displayValue =
    value === null
      ? '-'
      : format === 'decimal' || format === 'rate'
      ? formatDecimal(value)
      : formatNumber(value);

  const colors = colorMap[color];

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      <Card className={cn(
        'border-0 shadow-sm overflow-hidden cursor-pointer',
        'bg-gradient-to-br',
        colors.gradient
      )}>
        <CardContent className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">
                {title}
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl md:text-2xl font-bold tracking-tight">
                  {displayValue}
                </span>
                {suffix && value !== null && (
                  <span className="text-[10px] md:text-xs font-medium text-muted-foreground">
                    {suffix}
                  </span>
                )}
              </div>
            </div>
            <div className={cn(
              'flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl shrink-0',
              colors.bg
            )}>
              <Icon className={cn('h-5 w-5 md:h-5 md:w-5', colors.icon)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
