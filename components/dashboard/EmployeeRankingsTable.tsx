'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmployeeMetrics } from '@/types';
import { formatNumber, formatDecimal } from '@/lib/utils/numbers';
import { ArrowUpDown, Users } from 'lucide-react';

type SortField = 'efficiency' | 'rate' | 'articles' | 'views' | 'hours';

interface EmployeeRankingsTableProps {
  metrics: EmployeeMetrics[];
  isLoading?: boolean;
}

export function EmployeeRankingsTable({
  metrics,
  isLoading,
}: EmployeeRankingsTableProps) {
  const [sortField, setSortField] = useState<SortField>('efficiency');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedMetrics = [...metrics].sort((a, b) => {
    let aVal: number | null;
    let bVal: number | null;

    switch (sortField) {
      case 'efficiency':
        aVal = a.efficiency_views_per_hour;
        bVal = b.efficiency_views_per_hour;
        break;
      case 'rate':
        aVal = a.rate_articles_per_hour;
        bVal = b.rate_articles_per_hour;
        break;
      case 'articles':
        aVal = a.total_articles;
        bVal = b.total_articles;
        break;
      case 'views':
        aVal = a.total_views;
        bVal = b.total_views;
        break;
      case 'hours':
        aVal = a.total_hours;
        bVal = b.total_hours;
        break;
      default:
        aVal = 0;
        bVal = 0;
    }

    // Handle nulls (put at end)
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>דירוג עובדים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 rounded bg-muted animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown
        className={`h-3 w-3 mr-1 ${
          sortField === field ? 'opacity-100' : 'opacity-30'
        }`}
      />
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          דירוג עובדים
        </CardTitle>
        <CardDescription>
          ממוין לפי יעילות (צפיות/שעה). לחץ על כותרת עמודה למיון.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-sm">
                <th className="text-right py-3 px-2">#</th>
                <th className="text-right py-3 px-2">שם</th>
                <th className="text-right py-3 px-2">
                  <SortButton field="articles">כתבות</SortButton>
                </th>
                <th className="text-right py-3 px-2">
                  <SortButton field="views">צפיות</SortButton>
                </th>
                <th className="text-right py-3 px-2">צפ׳ לכתבה</th>
                <th className="text-right py-3 px-2">
                  <SortButton field="hours">שעות</SortButton>
                </th>
                <th className="text-right py-3 px-2">
                  <SortButton field="rate">קצב</SortButton>
                </th>
                <th className="text-right py-3 px-2">
                  <SortButton field="efficiency">יעילות</SortButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMetrics.map((emp, index) => (
                <tr
                  key={emp.employee_id}
                  className="border-b last:border-0 hover:bg-muted/50"
                >
                  <td className="py-3 px-2 font-bold text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="py-3 px-2 font-medium">{emp.employee_name}</td>
                  <td className="py-3 px-2">{formatNumber(emp.total_articles)}</td>
                  <td className="py-3 px-2">{formatNumber(emp.total_views)}</td>
                  <td className="py-3 px-2">
                    {emp.avg_views_per_article !== null
                      ? formatNumber(emp.avg_views_per_article)
                      : '-'}
                  </td>
                  <td className="py-3 px-2">{formatDecimal(emp.total_hours)}</td>
                  <td className="py-3 px-2">
                    {emp.rate_articles_per_hour !== null
                      ? formatDecimal(emp.rate_articles_per_hour)
                      : '-'}
                  </td>
                  <td className="py-3 px-2 font-bold">
                    {emp.efficiency_views_per_hour !== null
                      ? formatNumber(emp.efficiency_views_per_hour)
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {metrics.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            אין עובדים להצגה בטווח הנבחר
          </div>
        )}
      </CardContent>
    </Card>
  );
}
