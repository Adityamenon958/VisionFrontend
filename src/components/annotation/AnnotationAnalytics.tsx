import React, { useMemo } from "react";
import type { Annotation, Category } from "@/types/annotation";
import { BarChart3, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AnnotationAnalyticsProps {
  annotations: Annotation[];
  categories: Category[];
  startDate?: Date;
  endDate?: Date;
}

export const AnnotationAnalytics: React.FC<AnnotationAnalyticsProps> = ({
  annotations,
  categories,
  startDate,
  endDate,
}) => {
  // Calculate throughput (annotations per day)
  const throughput = useMemo(() => {
    if (annotations.length === 0) return { perDay: 0, perHour: 0 };

    const filtered = annotations.filter((ann) => {
      if (!ann.createdAt) return false;
      const created = new Date(ann.createdAt);
      if (startDate && created < startDate) return false;
      if (endDate && created > endDate) return false;
      return true;
    });

    if (filtered.length === 0) return { perDay: 0, perHour: 0 };

    const dates = filtered
      .map((ann) => ann.createdAt)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime())
      .sort((a, b) => a - b);

    if (dates.length === 0) return { perDay: 0, perHour: 0 };

    const timeSpan = dates[dates.length - 1] - dates[0];
    const days = Math.max(1, timeSpan / (1000 * 60 * 60 * 24));
    const hours = Math.max(1, timeSpan / (1000 * 60 * 60));

    return {
      perDay: Math.round((filtered.length / days) * 10) / 10,
      perHour: Math.round((filtered.length / hours) * 10) / 10,
    };
  }, [annotations, startDate, endDate]);

  // Category distribution
  const categoryDistribution = useMemo(() => {
    const distribution: Record<string, { count: number; percentage: number; color: string }> = {};

    annotations.forEach((ann) => {
      if (!distribution[ann.categoryId]) {
        const category = categories.find((c) => c.id === ann.categoryId);
        distribution[ann.categoryId] = {
          count: 0,
          percentage: 0,
          color: category?.color ?? "#6b7280",
        };
      }
      distribution[ann.categoryId].count++;
    });

    const total = annotations.length;
    Object.keys(distribution).forEach((catId) => {
      distribution[catId].percentage = total > 0 ? (distribution[catId].count / total) * 100 : 0;
    });

    return Object.entries(distribution).map(([categoryId, data]) => {
      const category = categories.find((c) => c.id === categoryId);
      return {
        categoryId,
        categoryName: category?.name ?? "Unknown",
        ...data,
      };
    });
  }, [annotations, categories]);

  // State distribution
  const stateDistribution = useMemo(() => {
    const states: Record<string, number> = {
      draft: 0,
      reviewed: 0,
      approved: 0,
      rejected: 0,
    };

    annotations.forEach((ann) => {
      const state = ann.state || "draft";
      states[state] = (states[state] || 0) + 1;
    });

    return states;
  }, [annotations]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        <h4 className="text-sm font-medium">Analytics</h4>
      </div>

      {/* Throughput Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">Throughput</CardTitle>
          <CardDescription className="text-[10px]">Annotation creation rate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Per Day:</span>
            </div>
            <span className="font-semibold">{throughput.perDay}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Per Hour:</span>
            </div>
            <span className="font-semibold">{throughput.perHour}</span>
          </div>
        </CardContent>
      </Card>

      {/* Category Distribution */}
      {categoryDistribution.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categoryDistribution
                .sort((a, b) => b.count - a.count)
                .map((item) => (
                  <div key={item.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.categoryName}</span>
                      </div>
                      <span className="font-medium">
                        {item.count} ({item.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* State Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">Review Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span>Draft:</span>
              <span className="font-medium">{stateDistribution.draft}</span>
            </div>
            <div className="flex justify-between">
              <span>Reviewed:</span>
              <span className="font-medium">{stateDistribution.reviewed}</span>
            </div>
            <div className="flex justify-between">
              <span>Approved:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {stateDistribution.approved}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Rejected:</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                {stateDistribution.rejected}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
