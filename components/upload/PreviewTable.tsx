'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ParsedHoursRow, ParsedArticleRow } from '@/types';
import { formatNumber } from '@/lib/utils/numbers';

interface HoursPreviewProps {
  type: 'hours';
  data: ParsedHoursRow[];
}

interface ArticlesPreviewProps {
  type: 'articles';
  data: ParsedArticleRow[];
}

type PreviewTableProps = HoursPreviewProps | ArticlesPreviewProps;

export function PreviewTable(props: PreviewTableProps) {
  const previewRows = props.data.slice(0, 10);

  if (props.type === 'hours') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>תצוגה מקדימה</CardTitle>
          <CardDescription>
            מציג {previewRows.length} מתוך {formatNumber(props.data.length)} שורות
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-2 px-2">שם</th>
                  <th className="text-right py-2 px-2">תאריך</th>
                  <th className="text-right py-2 px-2">שעות</th>
                  <th className="text-right py-2 px-2">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {(previewRows as ParsedHoursRow[]).map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 px-2">{row.fullName}</td>
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2">{row.hours}</td>
                    <td className="py-2 px-2">{row.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>תצוגה מקדימה</CardTitle>
        <CardDescription>
          מציג {previewRows.length} מתוך {formatNumber(props.data.length)} שורות
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right py-2 px-2">מספר כתבה</th>
                <th className="text-right py-2 px-2">שם</th>
                <th className="text-right py-2 px-2">כותרת</th>
                <th className="text-right py-2 px-2">צפיות</th>
              </tr>
            </thead>
            <tbody>
              {(previewRows as ParsedArticleRow[]).map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 px-2">{row.articleId}</td>
                  <td className="py-2 px-2">{row.fullName}</td>
                  <td className="py-2 px-2 truncate max-w-[200px]" title={row.title}>
                    {row.title}
                  </td>
                  <td className="py-2 px-2">{formatNumber(row.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
