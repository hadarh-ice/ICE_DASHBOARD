'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import {
  getGlobalMetrics,
  getEmployeeMetrics,
  getTopArticles,
} from '@/lib/queries/metrics';

interface UseMetricsOptions {
  dateRange?: DateRange;
  employeeIds?: string[];
}

export function useGlobalMetrics({ dateRange, employeeIds }: UseMetricsOptions) {
  return useQuery({
    queryKey: ['globalMetrics', dateRange, employeeIds],
    queryFn: () =>
      getGlobalMetrics({
        startDate: dateRange?.from
          ? format(dateRange.from, 'yyyy-MM-dd')
          : undefined,
        endDate: dateRange?.to
          ? format(dateRange.to, 'yyyy-MM-dd')
          : undefined,
        employeeIds: employeeIds?.length ? employeeIds : undefined,
      }),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useEmployeeMetrics({ dateRange, employeeIds }: UseMetricsOptions) {
  return useQuery({
    queryKey: ['employeeMetrics', dateRange, employeeIds],
    queryFn: () =>
      getEmployeeMetrics({
        startDate: dateRange?.from
          ? format(dateRange.from, 'yyyy-MM-dd')
          : undefined,
        endDate: dateRange?.to
          ? format(dateRange.to, 'yyyy-MM-dd')
          : undefined,
        employeeIds: employeeIds?.length ? employeeIds : undefined,
      }),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useTopArticles(
  { dateRange, employeeIds }: UseMetricsOptions,
  limit: number = 20
) {
  return useQuery({
    queryKey: ['topArticles', dateRange, employeeIds, limit],
    queryFn: () =>
      getTopArticles(
        {
          startDate: dateRange?.from
            ? format(dateRange.from, 'yyyy-MM-dd')
            : undefined,
          endDate: dateRange?.to
            ? format(dateRange.to, 'yyyy-MM-dd')
            : undefined,
          employeeIds: employeeIds?.length ? employeeIds : undefined,
        },
        limit
      ),
    staleTime: 60 * 1000, // 1 minute
  });
}
