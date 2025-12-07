'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TopArticle } from '@/types';
import { formatNumber } from '@/lib/utils/numbers';
import { ChevronDown, ChevronUp, Trophy, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopArticlesTableProps {
  articles: TopArticle[];
  isLoading?: boolean;
}

export function TopArticlesTable({
  articles,
  isLoading,
}: TopArticlesTableProps) {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const displayedArticles = showAll ? articles : articles.slice(0, 5);

  if (isLoading) {
    return (
      <div className="rounded-[14px] bg-white dark:bg-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="h-6 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4">
              <div className="h-5 w-3/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-2" />
              <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-white dark:bg-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            כתבות מובילות
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          הכתבות עם הכי הרבה צפיות בטווח הנבחר
        </p>
      </div>

      {/* Table Header - Sticky */}
      <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[13px] font-semibold text-gray-500 dark:text-gray-400">
          <div className="col-span-1">#</div>
          <div className="col-span-7">כותרת</div>
          <div className="col-span-4 text-left">כותב</div>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {displayedArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Eye className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">אין כתבות להצגה</p>
          </div>
        ) : (
          displayedArticles.map((article, index) => (
            <motion.button
              key={article.article_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => setSelectedId(
                selectedId === article.article_id ? null : article.article_id
              )}
              className={cn(
                'w-full grid grid-cols-12 gap-2 px-4 py-3.5 text-right',
                'transition-colors duration-150',
                'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                'active:bg-gray-100 dark:active:bg-gray-800',
                selectedId === article.article_id && 'bg-primary/5'
              )}
            >
              {/* Rank */}
              <div className="col-span-1 flex items-center">
                <span className={cn(
                  'text-sm font-bold',
                  index === 0 ? 'text-yellow-500' :
                  index === 1 ? 'text-gray-400' :
                  index === 2 ? 'text-orange-400' :
                  'text-gray-300'
                )}>
                  {index + 1}
                </span>
              </div>

              {/* Title & Views */}
              <div className="col-span-7 min-w-0 flex flex-col items-start gap-0.5">
                <span className="text-[15px] font-medium text-gray-900 dark:text-white truncate w-full text-right">
                  {article.title}
                </span>
                <span className="text-[12px] text-gray-400 flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {formatNumber(article.views)} צפיות
                </span>
              </div>

              {/* Author */}
              <div className="col-span-4 flex items-center justify-start">
                <span className="text-[14px] text-gray-500 dark:text-gray-400 truncate">
                  {article.employee_name}
                </span>
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* Show More/Less Button */}
      {articles.length > 5 && (
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
              הצג עוד ({articles.length - 5})
            </>
          )}
        </motion.button>
      )}
    </div>
  );
}
