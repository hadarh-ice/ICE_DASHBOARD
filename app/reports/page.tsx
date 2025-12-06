'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  FileBarChart,
  Download,
  Calendar,
  Clock,
  FileText,
  Users,
  TrendingUp,
} from 'lucide-react';
import { listContainerVariants, listItemVariants } from '@/lib/animations';

const reportTypes = [
  {
    id: 'hours-summary',
    title: 'סיכום שעות',
    description: 'סיכום שעות עבודה לפי עובד ותאריך',
    icon: Clock,
    color: 'blue',
    available: true,
  },
  {
    id: 'articles-summary',
    title: 'סיכום כתבות',
    description: 'סיכום כתבות וצפיות לפי עובד',
    icon: FileText,
    color: 'green',
    available: true,
  },
  {
    id: 'employee-performance',
    title: 'ביצועי עובדים',
    description: 'דוח ביצועים מפורט לכל עובד',
    icon: TrendingUp,
    color: 'purple',
    available: false,
  },
  {
    id: 'monthly-summary',
    title: 'סיכום חודשי',
    description: 'סיכום חודשי של כל הנתונים',
    icon: Calendar,
    color: 'orange',
    available: false,
  },
];

export default function ReportsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

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

  const handleGenerateReport = async (reportId: string) => {
    setGeneratingReport(reportId);
    // Simulate report generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setGeneratingReport(null);
    // TODO: Actually generate and download report
  };

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

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; gradient: string }> = {
      blue: {
        bg: 'bg-blue-500/10',
        icon: 'text-blue-600',
        gradient: 'from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10',
      },
      green: {
        bg: 'bg-green-500/10',
        icon: 'text-green-600',
        gradient: 'from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10',
      },
      purple: {
        bg: 'bg-purple-500/10',
        icon: 'text-purple-600',
        gradient: 'from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10',
      },
      orange: {
        bg: 'bg-orange-500/10',
        icon: 'text-orange-600',
        gradient: 'from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10',
      },
    };
    return colors[color] || colors.blue;
  };

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
          <h1 className="text-2xl md:text-3xl font-bold">דוחות</h1>
          <p className="text-sm text-muted-foreground mt-1">
            הפק וייצא דוחות מפורטים
          </p>
        </motion.div>

        {/* Report Types Grid */}
        <motion.div
          variants={listContainerVariants}
          className="grid gap-4 md:grid-cols-2"
        >
          {reportTypes.map((report) => {
            const colors = getColorClasses(report.color);
            const isGenerating = generatingReport === report.id;

            return (
              <motion.div key={report.id} variants={listItemVariants}>
                <Card
                  className={`relative overflow-hidden border-0 shadow-sm bg-gradient-to-br ${colors.gradient} ${
                    !report.available ? 'opacity-60' : ''
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-xl ${colors.bg}`}
                        >
                          <report.icon className={`h-5 w-5 ${colors.icon}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{report.title}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {report.description}
                          </CardDescription>
                        </div>
                      </div>
                      {!report.available && (
                        <Badge variant="secondary" className="text-[10px]">
                          בקרוב
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full h-10"
                      disabled={!report.available || isGenerating}
                      onClick={() => handleGenerateReport(report.id)}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          מייצר דוח...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 ml-2" />
                          הורד דוח
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Recent Reports Section */}
        <motion.div variants={listItemVariants}>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileBarChart className="h-5 w-5" />
                דוחות אחרונים
              </CardTitle>
              <CardDescription>
                דוחות שהופקו לאחרונה
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileBarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>אין דוחות אחרונים</p>
                <p className="text-sm">דוחות שתייצר יופיעו כאן</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
