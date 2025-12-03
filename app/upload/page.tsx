'use client';

export const dynamic = 'force-dynamic';

import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HoursUploader } from '@/components/upload/HoursUploader';
import { ArticlesUploader } from '@/components/upload/ArticlesUploader';
import { Clock, FileText } from 'lucide-react';

export default function UploadPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <Sidebar />
      <main className="pr-56 pt-14">
        <div className="container py-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">העלאת קבצים</h1>
          </div>

          <Tabs defaultValue="hours" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="hours" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                שעות עבודה
              </TabsTrigger>
              <TabsTrigger value="articles" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                כתבות
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hours" className="mt-6">
              <HoursUploader />
            </TabsContent>

            <TabsContent value="articles" className="mt-6">
              <ArticlesUploader />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
