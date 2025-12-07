'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { Navbar } from '@/components/layout/Navbar';
import { FilterSheet, FilterTrigger } from '@/components/filters/FilterSheet';
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
import { Loader2 } from 'lucide-react';
import { listContainerVariants, listItemVariants } from '@/lib/animations';

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

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

  const hasActiveFilters = !!dateRange?.from || selectedEmployees.length > 0;

  return (
    <AppShell>
      {/* iOS-style Navbar - Mobile Only */}
      <Navbar title="לוח בקרה" />

      <motion.div
        variants={listContainerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        {/* Page Header - Desktop Only */}
        <motion.div
          variants={listItemVariants}
          className="hidden md:flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">לוח בקרה</h1>
            <p className="text-sm text-muted-foreground mt-1">
              סקירה כללית של ביצועי הצוות
            </p>
          </div>
        </motion.div>

        {/* Filter Trigger - Mobile */}
        <motion.div variants={listItemVariants} className="md:hidden">
          <FilterTrigger
            onClick={() => setShowFilterSheet(true)}
            hasActiveFilters={hasActiveFilters}
            dateRange={dateRange}
            employeeCount={selectedEmployees.length}
          />
        </motion.div>

        {/* KPI Grid */}
        <motion.div variants={listItemVariants}>
          <KPIGrid metrics={globalMetrics ?? null} isLoading={isLoadingGlobal} />
        </motion.div>

        {/* Top Articles */}
        <motion.div variants={listItemVariants}>
          <TopArticlesTable
            articles={topArticles}
            isLoading={isLoadingArticles}
          />
        </motion.div>

        {/* Employee Rankings - Desktop Only */}
        <motion.div
          variants={listItemVariants}
          className="hidden lg:block"
        >
          <EmployeeRankingsTable
            metrics={employeeMetrics}
            isLoading={isLoadingEmployee}
          />
        </motion.div>
      </motion.div>

      {/* Filter Sheet Modal */}
      <FilterSheet
        isOpen={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        employees={employees}
        dateRange={dateRange}
        selectedEmployees={selectedEmployees}
        onDateRangeChange={setDateRange}
        onEmployeesChange={setSelectedEmployees}
        onReset={clearFilters}
      />
    </AppShell>
  );
}
