'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { EmployeeMetrics } from '@/types';
import { formatNumber } from '@/lib/utils/numbers';
import { ChevronDown, ChevronUp, Users, Eye, Zap, FileText, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmployeeRankingCardsProps {
  metrics: EmployeeMetrics[];
  isLoading?: boolean;
}

export function EmployeeRankingCards({
  metrics,
  isLoading,
}: EmployeeRankingCardsProps) {
  const [showAll, setShowAll] = useState(false);

  // Sort by efficiency (views per hour) descending - same as desktop
  const sortedMetrics = [...metrics].sort((a, b) => {
    const aVal = a.efficiency_views_per_hour;
    const bVal = b.efficiency_views_per_hour;
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    return bVal - aVal;
  });

  const displayedMetrics = showAll ? sortedMetrics : sortedMetrics.slice(0, 5);

  if (isLoading) {
    return (
      <div className="rounded-[14px] bg-white dark:bg-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="h-6 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
              <div className="flex-1">
                <div className="h-5 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-2" />
                <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Medal colors for top 3
  const getRankStyle = (index: number) => {
    if (index === 0) return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' };
    if (index === 1) return { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-500 dark:text-gray-300' };
    if (index === 2) return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-500 dark:text-orange-400' };
    return { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-400' };
  };

  return (
    <div className="rounded-[14px] bg-white dark:bg-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            דירוג עובדים
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          ממוין לפי יעילות (צפיות/שעה)
        </p>
      </div>

      {/* Employee List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {displayedMetrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Users className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">אין עובדים להצגה</p>
          </div>
        ) : (
          displayedMetrics.map((employee, index) => {
            const rankStyle = getRankStyle(index);
            return (
              <motion.div
                key={employee.employee_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  'flex items-start gap-3 px-4 py-4',
                  'transition-colors duration-150',
                  'active:bg-gray-50 dark:active:bg-gray-800/50'
                )}
              >
                {/* Rank Badge */}
                <div
                  className={cn(
                    'flex items-center justify-center',
                    'w-10 h-10 rounded-full',
                    'text-sm font-bold',
                    rankStyle.bg,
                    rankStyle.text
                  )}
                >
                  {index + 1}
                </div>

                {/* Employee Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-gray-900 dark:text-white truncate mb-2">
                    {employee.employee_name}
                  </p>

                  {/* All Metrics Grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {/* Articles */}
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-[13px] text-gray-600 dark:text-gray-300">
                        {formatNumber(employee.total_articles)} כתבות
                      </span>
                    </div>

                    {/* Views */}
                    <div className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-[13px] text-gray-600 dark:text-gray-300">
                        {formatNumber(employee.total_views)} צפיות
                      </span>
                    </div>

                    {/* Hours */}
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-[13px] text-gray-600 dark:text-gray-300">
                        {formatNumber(employee.total_hours)} שעות
                      </span>
                    </div>

                    {/* Views per Article */}
                    {employee.avg_views_per_article !== null && (
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                        <span className="text-[13px] text-gray-600 dark:text-gray-300">
                          {formatNumber(employee.avg_views_per_article)} צפ׳/כתבה
                        </span>
                      </div>
                    )}

                    {/* Pace/Rate */}
                    {employee.rate_articles_per_hour !== null && (
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="text-[13px] text-gray-600 dark:text-gray-300">
                          {employee.rate_articles_per_hour.toFixed(2)} קצב
                        </span>
                      </div>
                    )}

                    {/* Efficiency */}
                    {employee.efficiency_views_per_hour !== null && (
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
                          {formatNumber(employee.efficiency_views_per_hour)} יעילות
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Show More/Less Button */}
      {sortedMetrics.length > 5 && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAll(!showAll)}
          className={cn(
            'w-full flex items-center justify-center gap-2',
            'py-4 border-t border-gray-100 dark:border-gray-800',
            'text-sm font-medium text-primary',
            'hover:bg-gray-50 dark:hover:bg-gray-800/50',
            'transition-colors'
          )}
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4" />
              הצג פחות
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              הצג עוד ({sortedMetrics.length - 5})
            </>
          )}
        </motion.button>
      )}
    </div>
  );
}
