import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityItem, type Activity } from "./ActivityItem";

interface ActivityFeedProps {
  projects: any[];
  companyId: string | null;
}

/**
 * ActivityFeed Component
 * 
 * Displays recent activity feed with:
 * - Project creation events (from Supabase)
 * - Prediction events (from backend API, optional)
 * 
 * Gracefully handles API failures and shows fallback content.
 */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  projects,
  companyId,
}) => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!companyId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const fetchActivities = async () => {
      setLoading(true);
      const allActivities: Activity[] = [];

      try {
        // 1. Fetch project creation events from Supabase
        // Use projects prop (already loaded) to avoid duplicate fetch
        try {
          const projectActivities: Activity[] = projects
            .filter((project) => project.created_at)
            .slice(0, 5) // Limit to 5 most recent
            .map((project) => ({
              id: `project-${project.id}`,
              type: "project" as const,
              description: `New Project ${project.name} was created`,
              timestamp: project.created_at,
              icon: FolderKanban,
              projectName: project.name,
            }));

          allActivities.push(...projectActivities);
        } catch (error) {
          console.error("Error fetching project activities:", error);
          // Continue even if projects fail - we might have predictions
        }

        // 2. Try to fetch prediction events from backend API (optional)
        try {
          const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
          if (apiBaseUrl) {
            const url = `${apiBaseUrl.replace(/\/+$/, "")}/inference/history?limit=5`;
            const response = await fetch(url, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            });

            // Only process if request succeeds
            if (response.ok) {
              const data = await response.json();
              
              // Handle different response formats
              const predictions = Array.isArray(data)
                ? data
                : data.predictions || data.history || data.results || [];

              const predictionActivities: Activity[] = predictions
                .slice(0, 3) // Limit to 3 most recent predictions
                .map((prediction: any, index: number) => {
                  const imagesCount = prediction.totalImages || 
                                    prediction.imagesAnalyzed || 
                                    prediction.imageCount || 
                                    0;
                  const projectName = prediction.projectName || 
                                    prediction.project || 
                                    "Project";
                  
                  return {
                    id: `prediction-${prediction.inferenceId || prediction.id || index}`,
                    type: "prediction" as const,
                    description: `${imagesCount} images analyzed in ${projectName}`,
                    timestamp: prediction.createdAt || 
                              prediction.timestamp || 
                              prediction.created_at || 
                              new Date().toISOString(),
                    icon: Camera,
                    projectName: projectName,
                  };
                });

              allActivities.push(...predictionActivities);
            }
          }
        } catch (error) {
          // Silently fail - predictions are optional
          console.debug("Could not fetch prediction activities:", error);
        }

        // Sort all activities by timestamp (most recent first)
        allActivities.sort((a, b) => {
          const timeA = typeof a.timestamp === "string" 
            ? new Date(a.timestamp).getTime() 
            : a.timestamp.getTime();
          const timeB = typeof b.timestamp === "string" 
            ? new Date(b.timestamp).getTime() 
            : b.timestamp.getTime();
          return timeB - timeA;
        });

        // Limit to 5 most recent activities
        setActivities(allActivities.slice(0, 5));
      } catch (error) {
        console.error("Error fetching activities:", error);
        // Set empty array on error - will show "No recent activity"
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [projects, companyId]);

  if (loading) {
    return (
      <section className="space-y-4" aria-label="Recent activity loading">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        </div>
        <div className="space-y-2" role="list" aria-label="Loading activities">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 p-3">
              <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 transition-colors duration-300 ease-in-out" aria-label="Recent activity">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        {activities.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-xs h-7 px-2 hover:bg-muted hover:text-foreground transition-colors duration-200"
            aria-label="View all activities"
          >
            View All
          </Button>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-10" role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-1 relative pl-8 before:absolute before:left-6 before:top-0 before:bottom-0 before:w-0.5 before:bg-border/50" role="list" aria-label="Activity list">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </section>
  );
};

