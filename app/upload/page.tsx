'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HoursUploader } from '@/components/upload/HoursUploader';
import { ArticlesUploader } from '@/components/upload/ArticlesUploader';
import { Clock, FileText, Loader2 } from 'lucide-react';
import { listContainerVariants, listItemVariants } from '@/lib/animations';

export default function UploadPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

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
        <motion.div variants={listItemVariants}>
          <h1 className="text-2xl md:text-3xl font-bold">העלאת קבצים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            העלה קבצי שעות עבודה וכתבות
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={listItemVariants}>
          <Tabs defaultValue="hours" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 h-12">
              <TabsTrigger
                value="hours"
                className="flex items-center gap-2 h-10 text-sm"
              >
                <Clock className="h-4 w-4" />
                <span>שעות עבודה</span>
              </TabsTrigger>
              <TabsTrigger
                value="articles"
                className="flex items-center gap-2 h-10 text-sm"
              >
                <FileText className="h-4 w-4" />
                <span>כתבות</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hours" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <HoursUploader />
              </motion.div>
            </TabsContent>

            <TabsContent value="articles" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ArticlesUploader />
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
