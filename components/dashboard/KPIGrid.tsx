'use client';

import { motion } from 'framer-motion';
import { FileText, Eye, TrendingUp, Zap } from 'lucide-react';
import { KPICard } from './KPICard';
import { GlobalMetrics } from '@/types';
import { kpiContainerVariants, kpiCardVariants } from '@/lib/animations';

interface KPIGridProps {
  metrics: GlobalMetrics | null;
  isLoading?: boolean;
}

export function KPIGrid({ metrics, isLoading }: KPIGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[100px] md:h-[110px] rounded-xl bg-muted/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const kpiData = [
    {
      title: 'סה״כ כתבות',
      value: metrics?.total_articles ?? null,
      icon: FileText,
      color: 'blue' as const,
    },
    {
      title: 'סה״כ צפיות',
      value: metrics?.total_views ?? null,
      icon: Eye,
      color: 'green' as const,
    },
    {
      title: 'קצב ממוצע',
      value: metrics?.avg_rate ?? null,
      icon: TrendingUp,
      format: 'decimal' as const,
      suffix: 'כתבות/שעה',
      color: 'purple' as const,
    },
    {
      title: 'יעילות ממוצעת',
      value: metrics?.avg_efficiency ?? null,
      icon: Zap,
      format: 'number' as const,
      suffix: 'צפיות/שעה',
      color: 'orange' as const,
    },
  ];

  return (
    <motion.div
      variants={kpiContainerVariants}
      initial="hidden"
      animate="visible"
      className="grid gap-3 grid-cols-2 lg:grid-cols-4"
    >
      {kpiData.map((kpi, index) => (
        <motion.div key={kpi.title} variants={kpiCardVariants}>
          <KPICard {...kpi} />
        </motion.div>
      ))}
    </motion.div>
  );
}
