import React, { useMemo } from "react";
import { Progress } from "@/components/ui/progress";

interface AnnotationProgressProps {
  current: number;
  total: number;
  annotated: number;
}

export const AnnotationProgress: React.FC<AnnotationProgressProps> = ({
  current,
  total,
  annotated,
}) => {
  const safeTotal = total || 1;
  const percent = useMemo(
    () => Math.round(((annotated || 0) / safeTotal) * 100),
    [annotated, safeTotal]
  );

  return (
    <div className="space-y-1 min-w-[200px]">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">Progress</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <Progress value={percent} className="h-2" />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {current || 0} / {total} images
        </span>
        <span>{annotated} annotated</span>
      </div>
    </div>
  );
};


