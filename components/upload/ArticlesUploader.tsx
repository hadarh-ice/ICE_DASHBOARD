'use client';

import { useState } from 'react';
import { FileDropzone } from './FileDropzone';
import { PreviewTable } from './PreviewTable';
import { NameResolutionModal } from './NameResolutionModal';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parseArticlesFile } from '@/lib/parsers/articles';
import {
  ParsedArticleRow,
  EnhancedUploadResult,
  NameAnalysisResult,
  NameResolution,
  ResolvedNameMap,
} from '@/types';
import { toast } from 'sonner';
import { FileText, Upload, CheckCircle, AlertCircle, Users, Info } from 'lucide-react';

export function ArticlesUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedArticleRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<EnhancedUploadResult | null>(null);

  // Name resolution state
  const [nameAnalysis, setNameAnalysis] = useState<NameAnalysisResult | null>(null);
  const [showNameResolution, setShowNameResolution] = useState(false);
  const [resolvedNames, setResolvedNames] = useState<ResolvedNameMap | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setUploadResult(null);
    setUploadProgress(0);

    toast.info('מנתח קובץ...');

    const result = await parseArticlesFile(selectedFile);

    setParsedData(result.rows);
    setParseErrors(result.errors);

    if (result.rows.length > 0) {
      toast.success(`נמצאו ${result.rows.length} כתבות תקינות`);
    }
    if (result.errors.length > 0) {
      toast.warning(`${result.errors.length} שגיאות בניתוח`);
    }
  };

  /**
   * Step 1: Analyze names before upload
   * Identifies auto-matched names vs. names needing manual resolution
   */
  const handleAnalyzeNames = async () => {
    if (parsedData.length === 0) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      toast.info('מנתח שמות עובדים...');

      // Call name analysis API
      const response = await fetch('/api/upload/analyze-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedData,
          source: 'articles',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Name analysis failed');
      }

      const analysis: NameAnalysisResult = await response.json();
      setNameAnalysis(analysis);

      setUploadProgress(20);

      // If there are conflicts, show resolution modal
      if (analysis.needsResolution.length > 0) {
        toast.info(
          `נמצאו ${analysis.needsResolution.length} שמות הדורשים זיהוי ידני`
        );
        setShowNameResolution(true);
        setIsUploading(false);
      } else {
        // No conflicts - build name map from auto-matched and proceed to upload
        toast.success('כל השמות זוהו אוטומטית!');

        // Build name map from auto-matched names
        const autoMatchedMap: ResolvedNameMap = {};
        analysis.autoMatched.forEach((match) => {
          autoMatchedMap[match.inputName] = {
            employee_id: match.employee_id,
            confirmed_by_user: false, // Auto-matched, not user confirmed
          };
        });

        await proceedToUpload(analysis, autoMatchedMap);
      }
    } catch (error) {
      toast.error('שגיאה בניתוח שמות');
      console.error('Name analysis error:', error);
      setIsUploading(false);
    }
  };

  /**
   * Step 2: Handle user's name resolution decisions
   * Creates employees and aliases based on user choices
   */
  const handleNameResolutionComplete = async (resolutions: NameResolution[]) => {
    console.log('[ArticlesUploader] ✅ handleNameResolutionComplete called');
    console.log('[ArticlesUploader] Received resolutions:', resolutions);

    if (!nameAnalysis) return;

    setShowNameResolution(false);
    setIsUploading(true);
    setUploadProgress(30);

    try {
      toast.info('שומר החלטות זיהוי...');

      // Execute name resolutions
      console.log('[ArticlesUploader] 📤 Sending POST to /api/upload/execute-resolutions');
      const response = await fetch('/api/upload/execute-resolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutions,
          autoMatched: nameAnalysis.autoMatched,
          source: 'articles',
        }),
      });

      console.log('[ArticlesUploader] 📥 Response received:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Resolution execution failed');
      }

      const resolved: ResolvedNameMap = await response.json();
      setResolvedNames(resolved);

      setUploadProgress(50);

      // Proceed to actual data upload
      await proceedToUpload(nameAnalysis, resolved);
    } catch (error) {
      toast.error('שגיאה בשמירת זיהוי שמות');
      console.error('Resolution error:', error);
      setIsUploading(false);
    }
  };

  /**
   * Step 3: Actual data upload with resolved names
   */
  const proceedToUpload = async (
    analysis: NameAnalysisResult,
    resolved: ResolvedNameMap | null
  ) => {
    try {
      toast.info('מעלה נתוני כתבות...');
      setUploadProgress(60);

      // Build final name mapping
      const nameMapping: ResolvedNameMap = { ...(resolved || {}) };

      // Add auto-matched names to mapping
      analysis.autoMatched.forEach((match) => {
        nameMapping[match.inputName] = {
          employee_id: match.employee_id,
          confirmed_by_user: match.matchType === 'user-confirmed',
        };
      });

      // Call server-side API route
      const response = await fetch('/api/upload/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedData,
          fileName: file?.name || 'unknown',
          nameMapping,
        }),
      });

      setUploadProgress(90);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result: EnhancedUploadResult = await response.json();

      setUploadProgress(100);
      setUploadResult(result);

      // Display results
      if (result.errors && result.errors.length > 0) {
        toast.warning(
          `הושלם עם שגיאות: ${result.inserted} נוספו, ${result.updated} עודכנו, ${result.errors.length} שגיאות`
        );
      } else {
        let message = `הושלם! ${result.inserted} נוספו, ${result.updated} עודכנו`;
        if (result.ignoredLowViewArticles && result.ignoredLowViewArticles > 0) {
          message += `. ${result.ignoredLowViewArticles} כתבות בעלות צפיות נמוכות לא נכללו במדדים`;
        }
        toast.success(message);
      }
    } catch (error) {
      toast.error('שגיאה בהעלאה');
      console.error('Upload error:', error);
      setUploadResult({
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        detailedErrors: [],
        matchStats: {
          exactMatches: 0,
          fuzzyMatches: 0,
          newEmployees: 0,
        },
        processingTimeMs: 0,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setParsedData([]);
    setParseErrors([]);
    setUploadResult(null);
    setUploadProgress(0);
    setNameAnalysis(null);
    setShowNameResolution(false);
    setResolvedNames(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            העלאת קובץ כתבות
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropzone
            onFileSelect={handleFileSelect}
            accept={{
              'text/csv': ['.csv'],
            }}
            fileType="articles"
            selectedFile={file}
          />

          {parseErrors.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 font-medium text-yellow-800 mb-2">
                <AlertCircle className="h-4 w-4" />
                שגיאות בניתוח ({parseErrors.length})
              </div>
              <ul className="text-sm text-yellow-700 list-disc list-inside max-h-32 overflow-y-auto">
                {parseErrors.slice(0, 10).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
                {parseErrors.length > 10 && (
                  <li>...ועוד {parseErrors.length - 10} שגיאות</li>
                )}
              </ul>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>מעלה נתונים...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {uploadResult && (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 font-medium text-green-800 mb-3">
                  <CheckCircle className="h-4 w-4" />
                  העלאה הושלמה!
                </div>
                <div className="flex flex-wrap gap-2 text-sm mb-3">
                  <Badge variant="default">{uploadResult.inserted} נוספו</Badge>
                  <Badge variant="secondary">{uploadResult.updated} עודכנו</Badge>
                  {uploadResult.skipped > 0 && (
                    <Badge variant="outline">{uploadResult.skipped} דולגו</Badge>
                  )}
                </div>

                {/* Low-view articles info */}
                {uploadResult.ignoredLowViewArticles &&
                  uploadResult.ignoredLowViewArticles > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">
                          כתבות בעלות צפיות נמוכות ({uploadResult.ignoredLowViewArticles})
                        </p>
                        <p className="text-xs">
                          כתבות עם פחות מ-50 צפיות נשמרו במערכת אך לא ייכללו במדדי ביצועים
                        </p>
                      </div>
                    </div>
                  )}

                {/* Name resolution stats */}
                {uploadResult.nameResolutionStats && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 font-medium text-purple-800 mb-2">
                      <Users className="h-4 w-4" />
                      סטטיסטיקת זיהוי שמות
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">
                        {uploadResult.nameResolutionStats.autoMatched} זוהו אוטומטית
                      </Badge>
                      {uploadResult.nameResolutionStats.manuallyResolved > 0 && (
                        <Badge variant="outline">
                          {uploadResult.nameResolutionStats.manuallyResolved} זוהו ידנית
                        </Badge>
                      )}
                      {uploadResult.nameResolutionStats.newEmployeesCreated > 0 && (
                        <Badge variant="outline">
                          {uploadResult.nameResolutionStats.newEmployeesCreated} עובדים חדשים
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleAnalyzeNames}
              disabled={parsedData.length === 0 || isUploading}
            >
              <Upload className="h-4 w-4 ml-2" />
              העלה {parsedData.length > 0 && `(${parsedData.length} כתבות)`}
            </Button>
            {file && (
              <Button variant="outline" onClick={reset}>
                התחל מחדש
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {parsedData.length > 0 && (
        <PreviewTable type="articles" data={parsedData} />
      )}

      {/* Name Resolution Modal */}
      {nameAnalysis && (
        <NameResolutionModal
          isOpen={showNameResolution}
          conflicts={nameAnalysis.needsResolution}
          onResolve={handleNameResolutionComplete}
          onCancel={() => {
            setShowNameResolution(false);
            setIsUploading(false);
          }}
        />
      )}
    </div>
  );
}
