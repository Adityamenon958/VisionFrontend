import React from "react";
import type { AnnotationState } from "@/types/annotation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, Eye, FileCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AnnotationReviewToolbarProps {
  selectedState: AnnotationState | "all";
  onStateFilterChange: (state: AnnotationState | "all") => void;
  selectedAnnotationIds: string[];
  onBulkStateChange?: (state: AnnotationState) => void;
  annotationCounts?: {
    draft: number;
    reviewed: number;
    approved: number;
    rejected: number;
  };
}

export const AnnotationReviewToolbar: React.FC<AnnotationReviewToolbarProps> = ({
  selectedState,
  onStateFilterChange,
  selectedAnnotationIds,
  onBulkStateChange,
  annotationCounts,
}) => {
  const hasSelection = selectedAnnotationIds.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Review</h4>
        {hasSelection && (
          <Badge variant="secondary" className="text-xs">
            {selectedAnnotationIds.length} selected
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Filter by State</label>
          <Select
            value={selectedState}
            onValueChange={(value) => onStateFilterChange(value as AnnotationState | "all")}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All ({annotationCounts ? Object.values(annotationCounts).reduce((a, b) => a + b, 0) : 0})
              </SelectItem>
              <SelectItem value="draft">
                Draft ({annotationCounts?.draft ?? 0})
              </SelectItem>
              <SelectItem value="reviewed">
                Reviewed ({annotationCounts?.reviewed ?? 0})
              </SelectItem>
              <SelectItem value="approved">
                Approved ({annotationCounts?.approved ?? 0})
              </SelectItem>
              <SelectItem value="rejected">
                Rejected ({annotationCounts?.rejected ?? 0})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasSelection && onBulkStateChange && (
          <div className="space-y-1.5 pt-2 border-t">
            <label className="text-xs text-muted-foreground">Bulk Actions</label>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onBulkStateChange("reviewed")}
              >
                <Eye className="h-3 w-3 mr-1" />
                Review
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onBulkStateChange("approved")}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onBulkStateChange("rejected")}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onBulkStateChange("draft")}
              >
                <FileCheck className="h-3 w-3 mr-1" />
                Draft
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
