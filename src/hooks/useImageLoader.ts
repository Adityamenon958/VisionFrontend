import { useState, useEffect, useCallback } from "react";

interface UseImageLoaderReturn {
  loaded: boolean;
  error: boolean;
  retry: () => void;
}

/**
 * Hook to handle image loading state
 */
export const useImageLoader = (imageUrl: string | null): UseImageLoaderReturn => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
  }, []);

  const handleError = useCallback(() => {
    setLoaded(false);
    setError(true);
  }, []);

  const retry = useCallback(() => {
    setLoaded(false);
    setError(false);
    // Force reload by appending timestamp
    if (imageUrl) {
      const img = new Image();
      img.onload = handleLoad;
      img.onerror = handleError;
      img.src = imageUrl;
    }
  }, [imageUrl, handleLoad, handleError]);

  useEffect(() => {
    if (!imageUrl) {
      setLoaded(false);
      setError(false);
      return;
    }

    setLoaded(false);
    setError(false);

    const img = new Image();
    img.onload = handleLoad;
    img.onerror = handleError;
    img.src = imageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, handleLoad, handleError]);

  return { loaded, error, retry };
};

