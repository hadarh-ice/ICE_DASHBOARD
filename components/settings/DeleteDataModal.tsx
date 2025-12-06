'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'hours' | 'articles' | 'both';
  startDate: string;
  endDate: string;
  onConfirm: () => Promise<void>;
}

export function DeleteDataModal({
  open,
  onOpenChange,
  type,
  startDate,
  endDate,
  onConfirm,
}: DeleteDataModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'hours':
        return 'שעות';
      case 'articles':
        return 'כתבות';
      case 'both':
        return 'שעות וכתבות';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-500" />
            </div>
            <div>
              <DialogTitle className="text-right">אישור מחיקה</DialogTitle>
              <DialogDescription className="text-right">
                פעולה זו אינה ניתנת לביטול
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-4 text-right">
          <p className="text-sm text-muted-foreground">
            האם אתה בטוח שברצונך למחוק את הנתונים הבאים?
          </p>

          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">סוג נתונים:</span>
              <span className="text-red-700 dark:text-red-400 font-semibold">
                {getTypeLabel()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">תאריך התחלה:</span>
              <span>{startDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">תאריך סיום:</span>
              <span>{endDate}</span>
            </div>
          </div>

          <p className="text-sm font-semibold text-red-600 dark:text-red-500">
            כל הנתונים בטווח התאריכים הנבחר יימחקו לצמיתות.
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="flex-1"
          >
            ביטול
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מוחק...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 ml-2" />
                מחק נתונים
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
