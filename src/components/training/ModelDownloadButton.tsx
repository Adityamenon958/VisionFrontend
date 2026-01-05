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

interface ModelDownloadButtonProps {
  modelId: string;
  modelName: string;
  availableFormats?: ("pt" | "onnx" | "zip")[];
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  onDownloadError?: (error: Error) => void;
}

const formatLabels: Record<string, string> = {
  pt: "PyTorch (.pt)",
  onnx: "ONNX (.onnx)",
  zip: "ZIP Bundle (.zip)",
};

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

  const handleDownload = async (format: "pt" | "onnx" | "zip") => {
    setDownloading(format);
    setDownloadProgress(0);
    onDownloadStart?.();

    try {
      // Get signed download URL
      const { downloadUrl, fileSize } = await modelsApi.getModelDownloadUrl(
        modelId,
        format
      );

      // Download file
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        // If URL expired, retry with fresh URL
        if (response.status === 403 || response.status === 404) {
          const { downloadUrl: freshUrl } = await modelsApi.getModelDownloadUrl(
            modelId,
            format
          );
          const retryResponse = await fetch(freshUrl);
          if (!retryResponse.ok) {
            throw new Error(`Download failed: ${retryResponse.status}`);
          }
          const blob = await retryResponse.blob();
          downloadBlob(blob, modelName, format, fileSize);
        } else {
          throw new Error(`Download failed: ${response.status}`);
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, modelName, format, fileSize);
      }

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

  const downloadBlob = (
    blob: Blob,
    name: string,
    format: string,
    fileSize: number
  ) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.${format}`;
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
              Click to download
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

