'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept: Record<string, string[]>;
  fileType: 'hours' | 'articles';
  selectedFile?: File | null;
}

export function FileDropzone({
  onFileSelect,
  accept,
  fileType,
  selectedFile,
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        selectedFile && 'border-green-500 bg-green-50'
      )}
    >
      <input {...getInputProps()} />
      {selectedFile ? (
        <div className="flex flex-col items-center gap-2">
          <FileSpreadsheet className="h-12 w-12 text-green-500" />
          <p className="font-medium">{selectedFile.name}</p>
          <p className="text-sm text-muted-foreground">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <p className="text-xs text-muted-foreground">לחץ לבחירת קובץ אחר</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-12 w-12 text-muted-foreground" />
          <p className="font-medium">
            {isDragActive
              ? 'שחרר את הקובץ כאן'
              : fileType === 'hours'
              ? 'גרור קובץ שעות (XLSX) או לחץ לבחירה'
              : 'גרור קובץ כתבות (CSV) או לחץ לבחירה'}
          </p>
          <p className="text-sm text-muted-foreground">
            {fileType === 'hours'
              ? 'נתמכים: .xlsx, .xls'
              : 'נתמכים: .csv'}
          </p>
        </div>
      )}
    </div>
  );
}
