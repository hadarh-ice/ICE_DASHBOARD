'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useEmployees } from '@/hooks/useEmployees';
import { useEmployeeMetrics } from '@/hooks/useMetrics';
import { useFilterStore } from '@/stores/filters';
import {
  Loader2,
  Search,
  User,
  Clock,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  listContainerVariants,
  listItemVariants,
  kpiContainerVariants,
  kpiCardVariants,
} from '@/lib/animations';

export default function EmployeesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { dateRange } = useFilterStore();
  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: employeeMetrics = [], isLoading: isLoadingMetrics } = useEmployeeMetrics({
    dateRange,
    employeeIds: [],
  });

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

  // Create a map of employee metrics by ID
  const metricsMap = useMemo(() => {
    const map = new Map<string, (typeof employeeMetrics)[0]>();
    employeeMetrics.forEach((m) => {
      if (m.employee_id) {
        map.set(m.employee_id, m);
      }
    });
    return map;
  }, [employeeMetrics]);

  // Filter employees by search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const query = searchQuery.toLowerCase();
    return employees.filter(
      (emp) => emp.name?.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

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
        <motion.div variants={listItemVariants}>
          <h1 className="text-2xl md:text-3xl font-bold">עובדים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ניהול וצפייה בנתוני העובדים
          </p>
        </motion.div>

        {/* Stats Summary */}
        <motion.div
          variants={kpiContainerVariants}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        >
          <motion.div variants={kpiCardVariants}>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{employees.length}</p>
                    <p className="text-xs text-muted-foreground">סה״כ עובדים</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={kpiCardVariants}>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/10">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {employeeMetrics.filter((m) => (m.total_hours || 0) > 0).length}
                    </p>
                    <p className="text-xs text-muted-foreground">עובדים פעילים</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Search */}
        <motion.div variants={listItemVariants}>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חפש עובד..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-12"
            />
          </div>
        </motion.div>

        {/* Employee List */}
        <motion.div
          variants={listContainerVariants}
          className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {isLoadingEmployees || isLoadingMetrics ? (
            Array.from({ length: 6 }).map((_, i) => (
              <motion.div key={i} variants={listItemVariants}>
                <Card className="h-32 animate-pulse bg-muted/50" />
              </motion.div>
            ))
          ) : filteredEmployees.length === 0 ? (
            <motion.div
              variants={listItemVariants}
              className="col-span-full text-center py-12"
            >
              <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'לא נמצאו עובדים התואמים לחיפוש' : 'אין עובדים במערכת'}
              </p>
            </motion.div>
          ) : (
            filteredEmployees.map((employee) => {
              const metrics = metricsMap.get(employee.id);
              return (
                <motion.div key={employee.id} variants={listItemVariants}>
                  <Card className="group hover:shadow-md transition-all duration-200 cursor-pointer border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg shrink-0">
                          {employee.name?.[0] || '?'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {employee.name}
                          </h3>

                          {/* Metrics */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {metrics && (
                              <>
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Clock className="h-3 w-3" />
                                  {(metrics.total_hours || 0).toFixed(1)} שעות
                                </Badge>
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <FileText className="h-3 w-3" />
                                  {metrics.total_articles || 0} כתבות
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
