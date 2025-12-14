'use client';

import { useQuery } from '@tanstack/react-query';
import { getAllEmployees } from '@/lib/queries/metrics';
import type { QueryFilters } from '@/lib/queries/metrics';

export function useEmployees(filters?: Pick<QueryFilters, 'startDate' | 'endDate'>) {
  return useQuery({
    queryKey: ['employees', filters?.startDate, filters?.endDate],
    queryFn: () => getAllEmployees(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: typeof window !== 'undefined',
  });
}
