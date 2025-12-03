'use client';

import { useQuery } from '@tanstack/react-query';
import { getAllEmployees } from '@/lib/queries/metrics';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: getAllEmployees,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
