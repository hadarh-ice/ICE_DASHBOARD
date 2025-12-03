'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TopArticle } from '@/types';
import { formatNumber } from '@/lib/utils/numbers';
import { formatHebrewDate } from '@/lib/utils/dates';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';

interface TopArticlesTableProps {
  articles: TopArticle[];
  isLoading?: boolean;
}

export function TopArticlesTable({
  articles,
  isLoading,
}: TopArticlesTableProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedArticles = showAll ? articles : articles.slice(0, 5);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>כתבות מובילות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 rounded bg-muted animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          כתבות מובילות
        </CardTitle>
        <CardDescription>
          הכתבות עם הכי הרבה צפיות בטווח הנבחר
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
            <div className="col-span-1">#</div>
            <div className="col-span-5">כותרת</div>
            <div className="col-span-2">כותב</div>
            <div className="col-span-2">צפיות</div>
            <div className="col-span-2">תאריך</div>
          </div>
          {displayedArticles.map((article, index) => (
            <div
              key={article.article_id}
              className="grid grid-cols-12 gap-2 text-sm py-2 border-b last:border-0 hover:bg-muted/50 rounded"
            >
              <div className="col-span-1 font-bold text-muted-foreground">
                {index + 1}
              </div>
              <div className="col-span-5 truncate" title={article.title}>
                {article.title}
              </div>
              <div className="col-span-2 truncate">{article.employee_name}</div>
              <div className="col-span-2 font-medium">
                {formatNumber(article.views)}
              </div>
              <div className="col-span-2 text-muted-foreground">
                {formatHebrewDate(article.published_at)}
              </div>
            </div>
          ))}
        </div>
        {articles.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-4"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4 ml-2" />
                הצג פחות
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 ml-2" />
                הצג עוד ({articles.length - 5})
              </>
            )}
          </Button>
        )}
        {articles.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            אין כתבות להצגה בטווח הנבחר
          </div>
        )}
      </CardContent>
    </Card>
  );
}
