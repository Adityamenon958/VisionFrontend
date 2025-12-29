import React from "react";
import { formatDistanceToNow } from "date-fns";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Activity {
  id: string;
  type: "project" | "prediction" | "dataset" | "training";
  description: string;
  timestamp: Date | string;
  icon: LucideIcon;
  projectName?: string;
}

interface ActivityItemProps {
  activity: Activity;
}

/**
 * ActivityItem Component
 * 
 * Displays a single activity item with icon, description, and relative timestamp.
 */
export const ActivityItem: React.FC<ActivityItemProps> = ({ activity }) => {
  const Icon = activity.icon;
  const timestamp = typeof activity.timestamp === "string" 
    ? new Date(activity.timestamp) 
    : activity.timestamp;
  
  const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });

  return (
    <article 
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors duration-300 ease-in-out"
      role="listitem"
      aria-label={`Activity: ${activity.description} ${timeAgo}`}
    >
      <div 
        className="mt-0.5 flex-shrink-0 p-2 rounded-md bg-primary/10 dark:bg-primary/20"
        aria-hidden="true"
      >
        <Icon className="h-4 w-4 text-primary dark:text-primary" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground leading-relaxed">{activity.description}</p>
        <time 
          className="text-xs text-muted-foreground/60 block"
          dateTime={timestamp.toISOString()}
          title={timestamp.toLocaleString()}
        >
          {timeAgo}
        </time>
      </div>
    </article>
  );
};

