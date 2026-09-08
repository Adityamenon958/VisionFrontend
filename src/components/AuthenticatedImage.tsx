import React, { useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "@/lib/api/config";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Module-level cache so the same image isn't re-fetched every time a card
// re-renders across the app (mirrors the per-page cache pattern already
// used in PredictionHistoryDetailsPage.tsx, shared here across pages).
const objectUrlCache = new Map<string, string>();

/**
 * Renders an image served from an authenticated backend endpoint (e.g.
 * GET /api/inference/:inferenceId/image/:filename) by fetching it as a
 * blob with auth headers and rendering it as an object URL — a plain
 * <img src> can't send auth headers.
 */
export const AuthenticatedImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}> = ({ src, alt, className, onClick, style }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(objectUrlCache.get(src) || null);
  const [loading, setLoading] = useState(!objectUrlCache.has(src));
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (objectUrlCache.has(src)) {
      setObjectUrl(objectUrlCache.get(src) || null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(src, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        objectUrlCache.set(src, url);
        if (mountedRef.current) {
          setObjectUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.warn(`Failed to load authenticated image: ${src}`, err);
        if (mountedRef.current) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [src]);

  if (error) {
    return (
      <div className={cn(className, "bg-muted flex items-center justify-center")} style={style}>
        <span className="text-xs text-muted-foreground">Failed to load</span>
      </div>
    );
  }

  if (loading || !objectUrl) {
    return (
      <div className={cn(className, "bg-muted flex items-center justify-center")} style={style}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
    />
  );
};
