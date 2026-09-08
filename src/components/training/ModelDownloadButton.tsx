import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Download, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as modelsApi from "@/lib/api/models";
import { getAuthHeaders, apiUrl } from "@/lib/api/config";

type DownloadFormat = "pt" | "onnx" | "zip" | "tflite-float16" | "tflite-float32";

interface ModelDownloadButtonProps {
  modelId: string;
  modelName: string;
  availableFormats?: DownloadFormat[];
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  onDownloadError?: (error: Error) => void;
}

const formatLabels: Record<DownloadFormat, string> = {
  pt: "PyTorch (.pt)",
  onnx: "ONNX (.onnx)",
  zip: "ZIP Bundle (.zip)",
  "tflite-float16": "TFLite — float16 (.tflite)",
  "tflite-float32": "TFLite — float32 (.tflite)",
};

const formatHints: Partial<Record<DownloadFormat, string>> = {
  "tflite-float16": "For the mobile app. Smaller, near-identical accuracy.",
  "tflite-float32": "For the mobile app. Larger, full precision.",
};

/** Splits a UI format into the API's format + variant query params. */
function toApiFormat(format: DownloadFormat): {
  apiFormat: "pt" | "onnx" | "zip" | "tflite";
  variant?: "float16" | "float32";
} {
  if (format === "tflite-float16") return { apiFormat: "tflite", variant: "float16" };
  if (format === "tflite-float32") return { apiFormat: "tflite", variant: "float32" };
  return { apiFormat: format };
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const ModelDownloadButton: React.FC<ModelDownloadButtonProps> = ({
  modelId,
  modelName,
  availableFormats = ["pt", "onnx", "zip"],
  onDownloadStart,
  onDownloadComplete,
  onDownloadError,
}) => {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { toast } = useToast();

  const handleDownload = async (format: DownloadFormat) => {
    const { apiFormat, variant } = toApiFormat(format);
    setDownloading(format);
    setDownloadProgress(0);
    onDownloadStart?.();

    if (apiFormat === "tflite") {
      toast({
        title: "Preparing TFLite download",
        description:
          "If this is the first TFLite download for this model, converting from the checkpoint can take a few minutes.",
      });
    }

    try {
      // Get metadata (including file size) via authenticated API
      const { fileSize } = await modelsApi.getModelDownloadUrl(modelId, apiFormat, variant);

      // Download file using authenticated request to the download endpoint
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ format: apiFormat });
      if (variant) params.set("variant", variant);
      const downloadPath = `/models/${encodeURIComponent(
        modelId
      )}/download?${params.toString()}`;
      const response = await fetch(apiUrl(downloadPath), { headers });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const extension = apiFormat === "tflite" ? `${variant}.tflite` : apiFormat;
      downloadBlob(blob, `${modelName}.${extension}`, fileSize);

      toast({
        title: "Download complete",
        description: `${formatLabels[format]} downloaded successfully.`,
      });

      onDownloadComplete?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to download model";
      toast({
        title: "Download failed",
        description: errorMessage,
        variant: "destructive",
      });
      onDownloadError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  };

  const downloadBlob = (blob: Blob, filename: string, fileSize: number) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    setDownloadProgress(100);
  };

  if (availableFormats.length === 1) {
    // Single format - show direct button
    const format = availableFormats[0];
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleDownload(format)}
        disabled={!!downloading}
        className="gap-2"
      >
        {downloading === format ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Downloading...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download {formatLabels[format]}
          </>
        )}
      </Button>
    );
  }

  // Multiple formats - show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!!downloading}
          className="gap-2"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Download Model
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableFormats.map((format) => (
          <DropdownMenuItem
            key={format}
            onClick={() => handleDownload(format)}
            disabled={!!downloading}
            className="flex flex-col items-start gap-1"
          >
            <span className="font-medium">{formatLabels[format]}</span>
            <span className="text-xs text-muted-foreground">
              {formatHints[format] || "Click to download"}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
