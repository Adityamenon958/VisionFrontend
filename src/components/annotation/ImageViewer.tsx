import React, { useState, useRef } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImageLoader } from "@/hooks/useImageLoader";

interface ImageViewerProps {
  imageUrl: string | null;
  imageId: string | null;
  onImageLoad?: () => void;
  onImageError?: () => void;
  /**
   * Optional callback to report image metrics (used for precise bbox calculations)
   * - naturalWidth / naturalHeight: actual image resolution
   * - renderedWidth / renderedHeight: current displayed size in the DOM
   */
  onImageMetricsChange?: (metrics: {
    naturalWidth: number;
    naturalHeight: number;
    renderedWidth: number;
    renderedHeight: number;
  }) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageUrl,
  imageId,
  onImageLoad,
  onImageError,
   onImageMetricsChange,
}) => {
  const { loaded, error, retry } = useImageLoader(imageUrl);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleLoad = () => {
    setImageError(false);
    if (imgRef.current && onImageMetricsChange) {
      const img = imgRef.current;
      onImageMetricsChange({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: img.clientWidth,
        renderedHeight: img.clientHeight,
      });
    }
    onImageLoad?.();
  };

  const handleError = () => {
    setImageError(true);
    onImageError?.();
  };

  const handleRetry = () => {
    setImageError(false);
    retry();
  };

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        No image selected for annotation.
      </div>
    );
  }

  if (error || imageError) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3 p-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Failed to load image</p>
          <p className="text-xs text-muted-foreground">
            The image could not be loaded. Please try again.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="h-3 w-3 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Loading image...</p>
        </div>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={imageUrl}
      alt={imageId ?? "Annotation image"}
      className="max-h-full max-w-full object-contain"
      onLoad={handleLoad}
      onError={handleError}
    />
  );
};


