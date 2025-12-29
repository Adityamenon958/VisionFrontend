import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, isAfter, isWithinInterval } from "date-fns";

interface LastPrediction {
  imagesAnalyzed: number | null;
  status: string | null;
  timestamp: string | null;
}

interface DashboardMetrics {
  activeProjects: number;
  projectsThisWeek: number;
  datasets: number;
  newDatasets: number;
  lastPrediction: LastPrediction | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch dashboard metrics
 * 
 * Fetches:
 * - Active Projects (from projects prop - no fetch needed)
 * - Datasets count from Supabase
 * - Last Prediction from backend API
 * 
 * @param projects - Array of projects (from Dashboard state)
 * @param companyId - Company ID to filter datasets
 */
export const useDashboardMetrics = (
  projects: any[],
  companyId: string | null
): DashboardMetrics => {
  const [datasets, setDatasets] = useState<number>(0);
  const [newDatasets, setNewDatasets] = useState<number>(0);
  const [lastPrediction, setLastPrediction] = useState<LastPrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate projects metrics (no fetch needed)
  const activeProjects = projects.length;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const projectsThisWeek = projects.filter((project) => {
    if (!project.created_at) return false;
    const createdDate = new Date(project.created_at);
    return isAfter(createdDate, weekStart) || isWithinInterval(createdDate, {
      start: weekStart,
      end: new Date(),
    });
  }).length;

  // Fetch datasets from Supabase
  useEffect(() => {
    if (!companyId) {
      setDatasets(0);
      setNewDatasets(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const fetchDatasets = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("datasets")
          .select("id, created_at")
          .eq("company_id", companyId);

        if (fetchError) {
          console.error("Error fetching datasets:", fetchError);
          setError("Failed to load datasets");
          setLoading(false);
          return;
        }

        const datasetsCount = data?.length || 0;
        setDatasets(datasetsCount);

        // Calculate new datasets this week
        const weekStartDate = startOfWeek(new Date(), { weekStartsOn: 1 });
        const newDatasetsCount = data?.filter((dataset) => {
          if (!dataset.created_at) return false;
          const createdDate = new Date(dataset.created_at);
          return isAfter(createdDate, weekStartDate) || isWithinInterval(createdDate, {
            start: weekStartDate,
            end: new Date(),
          });
        }).length || 0;
        setNewDatasets(newDatasetsCount);
      } catch (err) {
        console.error("Error in fetchDatasets:", err);
        setError("Failed to load datasets");
      } finally {
        setLoading(false);
      }
    };

    fetchDatasets();
  }, [companyId]);

  // Fetch last prediction from backend API (optional - doesn't affect loading state)
  useEffect(() => {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
    if (!apiBaseUrl || !companyId) {
      // No API URL configured or no company - skip prediction fetch
      return;
    }

    const fetchLastPrediction = async () => {
      try {
        const url = `${apiBaseUrl.replace(/\/+$/, "")}/inference/history?limit=1`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        // If endpoint doesn't exist or fails, just skip (don't show error)
        if (!response.ok) {
          // Endpoint might not exist - that's okay
          return;
        }

        const data = await response.json();
        
        // Handle different response formats
        const predictions = Array.isArray(data) 
          ? data 
          : data.predictions || data.history || data.results || [];

        if (predictions.length > 0) {
          const latest = predictions[0];
          setLastPrediction({
            imagesAnalyzed: latest.totalImages || latest.imagesAnalyzed || latest.imageCount || null,
            status: latest.status || "completed",
            timestamp: latest.createdAt || latest.timestamp || latest.created_at || null,
          });
        }
      } catch (err) {
        // Silently fail - prediction data is optional
        console.debug("Could not fetch last prediction:", err);
      }
    };

    fetchLastPrediction();
  }, [companyId]);

  return {
    activeProjects,
    projectsThisWeek,
    datasets,
    newDatasets,
    lastPrediction,
    loading,
    error,
  };
};

