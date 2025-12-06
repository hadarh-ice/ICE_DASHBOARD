'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { FilterBar } from '@/components/filters/FilterBar';
import { KPIGrid } from '@/components/dashboard/KPIGrid';
import { TopArticlesTable } from '@/components/dashboard/TopArticlesTable';
import { EmployeeRankingsTable } from '@/components/dashboard/EmployeeRankingsTable';
import { useFilterStore } from '@/stores/filters';
import { useEmployees } from '@/hooks/useEmployees';
import {
  useGlobalMetrics,
  useEmployeeMetrics,
  useTopArticles,
} from '@/hooks/useMetrics';
import { Loader2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listContainerVariants, listItemVariants } from '@/lib/animations';

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const {
    dateRange,
    selectedEmployees,
    setDateRange,
    setSelectedEmployees,
    clearFilters,
  } = useFilterStore();

  const { data: employees = [] } = useEmployees();

  const filterOptions = {
    dateRange,
    employeeIds: selectedEmployees,
  };

  const { data: globalMetrics, isLoading: isLoadingGlobal } =
    useGlobalMetrics(filterOptions);
  const { data: employeeMetrics = [], isLoading: isLoadingEmployee } =
    useEmployeeMetrics(filterOptions);
  const { data: topArticles = [], isLoading: isLoadingArticles } =
    useTopArticles(filterOptions, 20);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
      } else {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <AppShell>
      <motion.div
        variants={listContainerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Page Header */}
        <motion.div
          variants={listItemVariants}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">לוח בקרה</h1>
            <p className="text-sm text-muted-foreground mt-1 hidden md:block">
              סקירה כללית של ביצועי הצוות
            </p>
          </div>

          {/* Mobile filter toggle */}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 ml-2" />
            סינון
          </Button>
        </motion.div>

        {/* Filters - always visible on desktop, toggle on mobile */}
        <motion.div
          variants={listItemVariants}
          className={`${showFilters ? 'block' : 'hidden'} md:block`}
        >
          <FilterBar
            employees={employees}
            dateRange={dateRange}
            selectedEmployees={selectedEmployees}
            onDateRangeChange={setDateRange}
            onEmployeesChange={setSelectedEmployees}
            onReset={clearFilters}
          />
        </motion.div>

        {/* KPI Grid */}
        <motion.div variants={listItemVariants}>
          <KPIGrid metrics={globalMetrics ?? null} isLoading={isLoadingGlobal} />
        </motion.div>

        {/* Tables Section */}
        <motion.div
          variants={listItemVariants}
          className="grid gap-6 lg:grid-cols-2"
        >
          <TopArticlesTable
            articles={topArticles}
            isLoading={isLoadingArticles}
          />
          <div className="lg:col-span-2">
            <EmployeeRankingsTable
              metrics={employeeMetrics}
              isLoading={isLoadingEmployee}
            />
          </div>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
