import React from "react";
import type { Annotation } from "@/types/annotation";
import { User, Clock, Edit } from "lucide-react";
// Simple date formatting without date-fns dependency
const formatDate = (dateString?: string): string => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
};

interface AnnotationMetadataProps {
  annotation: Annotation | null;
  userNames?: Record<string, string>; // Map of userId -> name
}

export const AnnotationMetadata: React.FC<AnnotationMetadataProps> = ({
  annotation,
  userNames = {},
}) => {
  if (!annotation) {
    return (
      <div className="text-xs text-muted-foreground p-2">
        No annotation selected
      </div>
    );
  }


  const getUserName = (userId?: string) => {
    if (!userId) return "Unknown";
    return userNames[userId] || userId.substring(0, 8);
  };

  return (
    <div className="space-y-2 text-xs p-2 border rounded-md bg-muted/30">
      <div className="font-medium text-sm mb-2">Annotation Details</div>
      
      {annotation.createdBy && (
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Created by:</span>
          <span className="font-medium">{getUserName(annotation.createdBy)}</span>
        </div>
      )}

      {annotation.createdAt && (
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Created:</span>
          <span className="font-medium">{formatDate(annotation.createdAt)}</span>
        </div>
      )}

      {annotation.updatedBy && annotation.updatedBy !== annotation.createdBy && (
        <div className="flex items-center gap-2">
          <Edit className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Modified by:</span>
          <span className="font-medium">{getUserName(annotation.updatedBy)}</span>
        </div>
      )}

      {annotation.updatedAt && (
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Modified:</span>
          <span className="font-medium">{formatDate(annotation.updatedAt)}</span>
        </div>
      )}

      {annotation.state && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <span className="text-muted-foreground">State:</span>
          <span
            className={`font-medium px-1.5 py-0.5 rounded text-[10px] ${
              annotation.state === "approved"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : annotation.state === "reviewed"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : annotation.state === "rejected"
                ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {annotation.state.charAt(0).toUpperCase() + annotation.state.slice(1)}
          </span>
        </div>
      )}
    </div>
  );
};

