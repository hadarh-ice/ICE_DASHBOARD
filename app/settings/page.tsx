'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Settings as SettingsIcon, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { listContainerVariants, listItemVariants } from '@/lib/animations';
import { DeleteDataModal } from '@/components/settings/DeleteDataModal';
import { DeleteDataRequest, DeleteDataResult } from '@/types';

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete form state
  const [deleteType, setDeleteType] = useState<'hours' | 'articles' | 'both'>('hours');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Auth check
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

  const handleDeleteData = async () => {
    setIsDeleting(true);

    try {
      const payload: DeleteDataRequest = {
        type: deleteType,
        startDate,
        endDate,
      };

      const response = await fetch('/api/delete-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: DeleteDataResult = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.errors[0] || 'Failed to delete data');
      }

      // Success
      const deletedItems = result.deletedHours + result.deletedArticles;
      toast.success(`נמחקו ${deletedItems} רשומות בהצלחה`, {
        description: `שעות: ${result.deletedHours}, כתבות: ${result.deletedArticles}`,
      });

      // Reset form
      setStartDate('');
      setEndDate('');

    } catch (error) {
      console.error('[Settings] Delete error:', error);
      toast.error('שגיאה במחיקת נתונים', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = () => {
    // Validate before showing modal
    if (!startDate || !endDate) {
      toast.error('נא למלא תאריכים');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      toast.error('תאריך סיום חייב להיות אחרי תאריך התחלה');
      return;
    }

    setShowConfirmModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        {/* Header */}
        <motion.div variants={listItemVariants}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10">
              <SettingsIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">הגדרות</h1>
              <p className="text-muted-foreground">ניהול הגדרות המערכת</p>
            </div>
          </div>
        </motion.div>

        {/* Danger Zone Card */}
        <motion.div variants={listItemVariants}>
          <Card className="border-red-200 dark:border-red-900 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10">
            <CardHeader className="pb-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-red-700 dark:text-red-400">
                    אזור מסוכן
                  </CardTitle>
                  <CardDescription className="text-red-600/70 dark:text-red-500/70">
                    פעולות אלו אינן ניתנות לביטול
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Delete Data Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <h3 className="font-semibold text-red-700 dark:text-red-400">
                    מחיקת נתונים לפי טווח תאריכים
                  </h3>
                </div>

                <p className="text-sm text-muted-foreground">
                  מחק רשומות שעות, כתבות או שניהם בטווח תאריכים מסוים
                </p>

                <div className="space-y-4 bg-white dark:bg-gray-950 rounded-lg p-4 border">
                  {/* Data Type Selector */}
                  <div className="space-y-2">
                    <Label htmlFor="delete-type">סוג נתונים</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={deleteType === 'hours' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDeleteType('hours')}
                        disabled={isDeleting}
                      >
                        שעות בלבד
                      </Button>
                      <Button
                        type="button"
                        variant={deleteType === 'articles' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDeleteType('articles')}
                        disabled={isDeleting}
                      >
                        כתבות בלבד
                      </Button>
                      <Button
                        type="button"
                        variant={deleteType === 'both' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDeleteType('both')}
                        disabled={isDeleting}
                      >
                        שעות + כתבות
                      </Button>
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">תאריך התחלה</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={isDeleting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">תאריך סיום</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={isDeleting}
                      />
                    </div>
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleDeleteClick}
                    disabled={isDeleting || !startDate || !endDate}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                        מוחק נתונים...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 ml-2" />
                        מחק נתונים
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Confirmation Modal */}
      <DeleteDataModal
        open={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        type={deleteType}
        startDate={startDate}
        endDate={endDate}
        onConfirm={handleDeleteData}
      />
    </AppShell>
  );
}
