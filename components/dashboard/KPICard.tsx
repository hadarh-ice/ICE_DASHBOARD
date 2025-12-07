'use client';

import { motion } from 'framer-motion';
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
  isLoading?: boolean;
}

const colorMap = {
  blue: {
    bg: 'bg-[#E8F0FE]',
    iconBg: 'bg-[#D2E3FC]',
    icon: 'text-[#1A73E8]',
    gradient: 'from-[#E8F0FE] to-[#F1F6FE]',
  },
  green: {
    bg: 'bg-[#E6F7ED]',
    iconBg: 'bg-[#CEEAD6]',
    icon: 'text-[#1E8E3E]',
    gradient: 'from-[#E6F7ED] to-[#F0FAF4]',
  },
  purple: {
    bg: 'bg-[#F3E8FF]',
    iconBg: 'bg-[#E9D5FF]',
    icon: 'text-[#9333EA]',
    gradient: 'from-[#F3E8FF] to-[#FAF5FF]',
  },
  orange: {
    bg: 'bg-[#FEF3E2]',
    iconBg: 'bg-[#FDE7C7]',
    icon: 'text-[#E07800]',
    gradient: 'from-[#FEF3E2] to-[#FFFBF5]',
  },
};

export function KPICard({
  title,
  value,
  icon: Icon,
  format = 'number',
  suffix,
  color = 'blue',
  isLoading = false,
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
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25
      }}
      className="h-full"
    >
      <div
        className={cn(
          'relative h-full',
          'rounded-[14px]',
          'bg-gradient-to-br',
          colors.gradient,
          'shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
          'overflow-hidden',
          'cursor-pointer'
        )}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Icon */}
            <div
              className={cn(
                'flex items-center justify-center',
                'w-11 h-11 rounded-full shrink-0',
                colors.iconBg
              )}
            >
              <Icon className={cn('h-5 w-5', colors.icon)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium truncate">
                {title}
              </p>
              <div className="mt-1.5 flex items-baseline gap-1">
                {isLoading ? (
                  <div className="h-7 w-20 bg-gray-200/50 rounded-lg animate-pulse" />
                ) : (
                  <>
                    <span className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
                      {displayValue}
                    </span>
                    {suffix && value !== null && (
                      <span className="text-[11px] font-medium text-gray-400">
                        {suffix}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
