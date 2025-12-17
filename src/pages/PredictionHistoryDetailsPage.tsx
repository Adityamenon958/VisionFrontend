import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/pages/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface HistoryInferenceResults {
  totalDetections: number;
  averageConfidence: number;
  detectionsByClass: Array<{
    className: string;
    count: number;
    avgConfidence?: number;
    averageConfidence?: number;
  }>;
  annotatedImages: Array<{
    filename: string;
    url: string;
  }>;
}

const PredictionHistoryDetailsPage = () => {
  const { inferenceId } = useParams<{ inferenceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<HistoryInferenceResults | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (!inferenceId) return;

      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        const base = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
        const url =
          (base ? `${base}` : "") +
          `/inference/${encodeURIComponent(inferenceId)}/results`;

        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!res.ok) {
          toast({
            title: "Failed to load results",
            description: "Results are not ready yet or not found.",
            variant: "destructive",
          });
          return;
        }

        const response = await res.json();
        const data = (response.results || response) as HistoryInferenceResults;

        const normalized: HistoryInferenceResults = {
          ...data,
          detectionsByClass:
            data.detectionsByClass?.map((item) => ({
              ...item,
              averageConfidence: item.avgConfidence ?? item.averageConfidence ?? 0,
            })) || [],
          annotatedImages:
            data.annotatedImages?.map((img) => {
              const raw = img.url || "";
              // Ensure we do not duplicate "/api" if base already contains it
              const basePath = raw.startsWith("/api/") ? raw.slice(4) : raw;
              const apiBase = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
              const fullUrl = apiBase ? `${apiBase}/${basePath.replace(/^\/+/, "")}` : raw;
              return { ...img, url: fullUrl };
            }) || [],
        };

        setResults(normalized);
      } catch (err: any) {
        console.error("Error loading history results:", err);
        toast({
          title: "Failed to load results",
          description: err?.message || "Could not fetch inference results.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchResults();
  }, [inferenceId, toast]);

  return (
    <div className={cn("container mx-auto py-6 space-y-6")}>
      <PageHeader
        title="Inference Results"
        description="View detailed results for a completed inference job"
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/project/prediction")}
        className="px-0"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Prediction History
      </Button>

      {loading ? (
        <Card>
          <CardContent className="py-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : !results ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-center text-muted-foreground">
              Results are not available for this inference.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Results Summary</CardTitle>
              <CardDescription>
                Inference ID: {inferenceId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xl font-bold">{results.totalDetections}</div>
                  <div className="text-xs text-muted-foreground">Total Detections</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {(results.averageConfidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Average Confidence</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {results.detectionsByClass.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Classes Detected</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detections by Class */}
          {results.detectionsByClass.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Detections by Class</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Class</th>
                        <th className="text-right p-2">Count</th>
                        <th className="text-right p-2">Avg Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.detectionsByClass.map((item, idx) => (
                        <tr key={item.className || `history-class-${idx}`} className="border-b">
                          <td className="p-2 font-medium">{item.className}</td>
                          <td className="p-2 text-right">{item.count}</td>
                          <td className="p-2 text-right">
                            {(item.averageConfidence! * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Annotated Images */}
          {results.annotatedImages && results.annotatedImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Annotated Images</CardTitle>
                <CardDescription>
                  {results.annotatedImages.length} image
                  {results.annotatedImages.length !== 1 ? "s" : ""} with detections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {results.annotatedImages.map((img, idx) => (
                    <div
                      key={img.filename || img.url || `history-image-${idx}`}
                      className="space-y-2"
                    >
                      <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                        <img
                          src={img.url}
                          alt={img.filename}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {img.filename}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default PredictionHistoryDetailsPage;


