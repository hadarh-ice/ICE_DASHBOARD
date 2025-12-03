'use client';

export const dynamic = 'force-dynamic';

import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
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

export default function DashboardPage() {
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

  return (
    <div className="min-h-screen">
      <Header />
      <Sidebar />
      <main className="pr-56 pt-14">
        <div className="container py-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">לוח בקרה</h1>
          </div>

          <FilterBar
            employees={employees}
            dateRange={dateRange}
            selectedEmployees={selectedEmployees}
            onDateRangeChange={setDateRange}
            onEmployeesChange={setSelectedEmployees}
            onReset={clearFilters}
          />

          <KPIGrid metrics={globalMetrics ?? null} isLoading={isLoadingGlobal} />

          <div className="grid gap-6 lg:grid-cols-2">
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
          </div>
        </div>
      </main>
    </div>
  );
}
