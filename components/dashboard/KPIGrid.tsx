'use client';

import { FileText, Eye, TrendingUp, Zap } from 'lucide-react';
import { KPICard } from './KPICard';
import { GlobalMetrics } from '@/types';

interface KPIGridProps {
  metrics: GlobalMetrics | null;
  isLoading?: boolean;
}

export function KPIGrid({ metrics, isLoading }: KPIGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[120px] rounded-lg border bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="סה״כ כתבות"
        value={metrics?.total_articles ?? null}
        icon={FileText}
      />
      <KPICard
        title="סה״כ צפיות"
        value={metrics?.total_views ?? null}
        icon={Eye}
      />
      <KPICard
        title="קצב ממוצע"
        value={metrics?.avg_rate ?? null}
        icon={TrendingUp}
        format="decimal"
        suffix="כתבות/שעה"
      />
      <KPICard
        title="יעילות ממוצעת"
        value={metrics?.avg_efficiency ?? null}
        icon={Zap}
        format="number"
        suffix="צפיות/שעה"
      />
    </div>
  );
}
