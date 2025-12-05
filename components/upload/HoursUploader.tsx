'use client';

import { useState } from 'react';
import { FileDropzone } from './FileDropzone';
import { PreviewTable } from './PreviewTable';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parseHoursFile } from '@/lib/parsers/hours';
import { ParsedHoursRow, UpsertResult } from '@/types';
import { toast } from 'sonner';
import { Clock, Upload, CheckCircle, AlertCircle } from 'lucide-react';

export function HoursUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedHoursRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UpsertResult | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setUploadResult(null);
    setUploadProgress(0);

    toast.info('מנתח קובץ...');

    const result = await parseHoursFile(selectedFile);

    setParsedData(result.rows);
    setParseErrors(result.errors);

    if (result.rows.length > 0) {
      toast.success(`נמצאו ${result.rows.length} שורות תקינות`);
    }
    if (result.errors.length > 0) {
      toast.warning(`${result.errors.length} שגיאות בניתוח`);
    }
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      toast.info('מעלה נתונים...');
      setUploadProgress(30);

      // Call server-side API route (bypasses RLS)
      const response = await fetch('/api/upload/hours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rows: parsedData,
          fileName: file?.name || 'unknown',
        }),
      });

      setUploadProgress(80);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result: UpsertResult = await response.json();

      setUploadProgress(100);
      setUploadResult(result);

      if (result.errors && result.errors.length > 0) {
        toast.warning(
          `הושלם עם שגיאות: ${result.inserted} נוספו, ${result.updated} עודכנו, ${result.errors.length} שגיאות`
        );
      } else {
        toast.success(
          `הושלם! ${result.inserted} נוספו, ${result.updated} עודכנו, ${result.skipped} דולגו`
        );
      }
    } catch (error) {
      toast.error('שגיאה בהעלאה');
      console.error('Upload error:', error);
      setUploadResult({
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
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
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            העלאת קובץ שעות עבודה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropzone
            onFileSelect={handleFileSelect}
            accept={{
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                ['.xlsx'],
              'application/vnd.ms-excel': ['.xls'],
            }}
            fileType="hours"
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
            <div className={`p-4 border rounded-lg ${
              uploadResult.errors && uploadResult.errors.length > 0
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className={`flex items-center gap-2 font-medium mb-2 ${
                uploadResult.errors && uploadResult.errors.length > 0
                  ? 'text-yellow-800'
                  : 'text-green-800'
              }`}>
                {uploadResult.errors && uploadResult.errors.length > 0 ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                העלאה הושלמה{uploadResult.errors && uploadResult.errors.length > 0 ? ' עם אזהרות' : '!'}
              </div>
              <div className="flex flex-wrap gap-2 text-sm mb-2">
                <Badge variant="default">{uploadResult.inserted} נוספו</Badge>
                <Badge variant="secondary">{uploadResult.updated} עודכנו</Badge>
                {uploadResult.skipped > 0 && (
                  <Badge variant="outline">{uploadResult.skipped} דולגו</Badge>
                )}
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <Badge variant="destructive">{uploadResult.errors.length} שגיאות</Badge>
                )}
              </div>
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-yellow-700 hover:text-yellow-800">
                    הצג {uploadResult.errors.length} שגיאות
                  </summary>
                  <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside max-h-40 overflow-y-auto bg-yellow-100 p-2 rounded">
                    {uploadResult.errors.slice(0, 50).map((error, i) => (
                      <li key={i} className="truncate" title={error}>{error}</li>
                    ))}
                    {uploadResult.errors.length > 50 && (
                      <li className="font-medium">...ועוד {uploadResult.errors.length - 50} שגיאות</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={parsedData.length === 0 || isUploading}
            >
              <Upload className="h-4 w-4 ml-2" />
              העלה {parsedData.length > 0 && `(${parsedData.length} שורות)`}
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
        <PreviewTable type="hours" data={parsedData} />
      )}
    </div>
  );
}
