import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2, FileCode, FileJson } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api/config";

interface AnnotationExportButtonProps {
  datasetId: string;
  imageIds?: string[];
  onExportComplete?: () => void;
}

type ExportFormat = "yolo" | "coco" | "json";

export const AnnotationExportButton: React.FC<AnnotationExportButtonProps> = ({
  datasetId,
  imageIds,
  onExportComplete,
}) => {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const { toast } = useToast();

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);

    try {
      const queryParams = new URLSearchParams();
      queryParams.append("format", format);
      if (imageIds && imageIds.length > 0) {
        queryParams.append("imageIds", imageIds.join(","));
      }

      const path = `/dataset/${encodeURIComponent(datasetId)}/export-annotations?${queryParams.toString()}`;
      
      // Get download URL or blob
      const response = await apiRequest<{ downloadUrl: string } | Blob>(path);
      
      if (response instanceof Blob) {
        // Direct blob response
        const url = window.URL.createObjectURL(response);
        const a = document.createElement("a");
        a.href = url;
        a.download = `annotations_${datasetId}_${format}.${format === "json" ? "json" : format === "coco" ? "json" : "txt"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else if (response.downloadUrl) {
        // Signed URL response
        window.open(response.downloadUrl, "_blank");
      }

      toast({
        title: "Export successful",
        description: `Annotations exported as ${format.toUpperCase()}`,
      });

      onExportComplete?.();
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export annotations",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!!exporting}
          className="gap-2"
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport("yolo")}
          disabled={!!exporting}
          className="gap-2"
        >
          <FileCode className="h-4 w-4" />
          YOLO Format
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("coco")}
          disabled={!!exporting}
          className="gap-2"
        >
          <FileJson className="h-4 w-4" />
          COCO Format
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("json")}
          disabled={!!exporting}
          className="gap-2"
        >
          <FileJson className="h-4 w-4" />
          JSON Format
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
