'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Check, X, User, Users, ChevronRight, ChevronLeft } from 'lucide-react';
import { NameConflict, NameResolution } from '@/types';
import { getConfidenceLevelText } from '@/lib/config/matching-thresholds';

interface NameResolutionModalProps {
  isOpen: boolean;
  conflicts: NameConflict[];
  onResolve: (resolutions: NameResolution[]) => void;
  onCancel: () => void;
}

/**
 * NameResolutionModal Component
 *
 * Interactive modal for resolving name conflicts during upload.
 * Shows one conflict at a time with options to match existing employee
 * or create new employee.
 *
 * Features:
 * - Step-by-step resolution (one conflict at a time)
 * - Progress tracking (X of Y resolved)
 * - Back/Next navigation
 * - Visual confidence indicators
 * - Mobile-optimized (iPhone primary use case)
 * - Hebrew RTL support
 */
export function NameResolutionModal({
  isOpen,
  conflicts,
  onResolve,
  onCancel,
}: NameResolutionModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Map<string, NameResolution>>(
    new Map()
  );

  const currentConflict = conflicts[currentIndex];
  const progress = ((currentIndex + 1) / conflicts.length) * 100;
  const isLastConflict = currentIndex === conflicts.length - 1;
  const resolvedCount = resolutions.size;
  const totalCount = conflicts.length;

  // Handle resolution decision
  const handleResolve = (resolution: NameResolution) => {
    const newResolutions = new Map(resolutions);
    newResolutions.set(currentConflict.inputName, resolution);
    setResolutions(newResolutions);

    // Auto-advance to next conflict if not last
    if (!isLastConflict) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Handle next navigation
  const handleNext = () => {
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Handle final submission
  const handleSubmit = () => {
    // Check if all conflicts are resolved
    const unresolvedCount = conflicts.filter(
      (c) => !resolutions.has(c.inputName)
    ).length;

    if (unresolvedCount > 0) {
      // Find first unresolved and jump to it
      const firstUnresolved = conflicts.findIndex(
        (c) => !resolutions.has(c.inputName)
      );
      setCurrentIndex(firstUnresolved);
      return;
    }

    // All resolved - submit
    onResolve(Array.from(resolutions.values()));
  };

  // Handle cancel with confirmation if partially resolved
  const handleCancel = () => {
    if (resolvedCount > 0) {
      if (
        window.confirm(
          `יש לך ${resolvedCount} החלטות שטרם נשמרו. האם אתה בטוח שברצונך לבטל?`
        )
      ) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setResolutions(new Map());
    }
  }, [isOpen]);

  if (!currentConflict) return null;

  const isResolved = resolutions.has(currentConflict.inputName);
  const currentResolution = resolutions.get(currentConflict.inputName);
  const hasCandidates = currentConflict.candidates.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            זיהוי שמות עובדים ({currentIndex + 1} מתוך {totalCount})
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {resolvedCount} מתוך {totalCount} נפתרו
          </p>
        </div>

        {/* Current Conflict Card */}
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4 space-y-3">
            {/* Input Name */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                שם מהקובץ:
              </label>
              <p className="text-lg font-semibold">{currentConflict.inputName}</p>
              <p className="text-xs text-muted-foreground">
                מופיע בשורות: {currentConflict.rowNumbers.join(', ')}
              </p>
            </div>

            {/* Confidence Badge */}
            <Badge
              variant={currentConflict.confidence === 'medium' ? 'default' : 'destructive'}
            >
              {currentConflict.confidence === 'medium'
                ? 'דמיון בינוני (75-84%)'
                : 'דמיון נמוך (<75%)'}
            </Badge>

            {/* Helper Text */}
            {currentConflict.confidence === 'low' && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                לא נמצא התאמה קרובה. בחר עובד קיים או צור חדש.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Resolution Options */}
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground">
            בחר אפשרות:
          </h3>

          {/* Option 1: Match to existing employee */}
          {hasCandidates && (
            <div className="space-y-2">
              <p className="text-sm font-medium">התאם לעובד קיים:</p>
              {currentConflict.candidates.map((candidate) => (
                <Button
                  key={candidate.employee_id}
                  variant={
                    currentResolution?.employee_id === candidate.employee_id
                      ? 'default'
                      : 'outline'
                  }
                  className="w-full justify-between h-auto py-3"
                  onClick={() =>
                    handleResolve({
                      inputName: currentConflict.inputName,
                      action: 'match',
                      employee_id: candidate.employee_id,
                      confirmed_by_user: true,
                    })
                  }
                >
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-right">{candidate.canonical_name}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {candidate.is_user_confirmed && (
                      <Badge variant="secondary" className="text-xs">
                        אושר בעבר
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {getConfidenceLevelText(candidate.similarity_score)}
                    </Badge>
                  </div>
                </Button>
              ))}
            </div>
          )}

          {/* Option 2: Create new employee */}
          <div className={hasCandidates ? 'pt-2 border-t' : ''}>
            <Button
              variant={
                currentResolution?.action === 'create-new' ? 'default' : 'outline'
              }
              className="w-full justify-start"
              onClick={() =>
                handleResolve({
                  inputName: currentConflict.inputName,
                  action: 'create-new',
                  confirmed_by_user: true,
                })
              }
            >
              <User className="h-4 w-4 ml-2" />
              צור עובד חדש: "{currentConflict.inputName}"
            </Button>
          </div>
        </div>

        {/* Current Selection Display */}
        {isResolved && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-800 dark:text-green-200">
              {currentResolution?.action === 'match'
                ? `יותאם ל: ${
                    currentConflict.candidates.find(
                      (c) => c.employee_id === currentResolution.employee_id
                    )?.canonical_name
                  }`
                : 'ייווצר עובד חדש'}
            </span>
          </div>
        )}

        {/* Navigation Buttons */}
        <DialogFooter className="flex flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            <X className="h-4 w-4 ml-2" />
            ביטול
          </Button>

          {currentIndex > 0 && (
            <Button variant="outline" onClick={handleBack} className="flex-1">
              <ChevronRight className="h-4 w-4 ml-1" />
              חזור
            </Button>
          )}

          {!isLastConflict ? (
            <Button
              onClick={handleNext}
              disabled={!isResolved}
              className="flex-1"
            >
              הבא
              <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={resolvedCount !== totalCount}
              className="flex-1"
            >
              <Check className="h-4 w-4 ml-2" />
              סיים והעלה ({resolvedCount}/{totalCount})
            </Button>
          )}
        </DialogFooter>

        {/* Unresolved Warning */}
        {isLastConflict && resolvedCount !== totalCount && (
          <p className="text-sm text-yellow-600 dark:text-yellow-400 text-center flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            יש {totalCount - resolvedCount} שמות שטרם נפתרו
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
