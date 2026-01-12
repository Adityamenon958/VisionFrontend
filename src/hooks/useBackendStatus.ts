import { useState, useEffect, useRef } from "react";

interface BackendStatus {
  isOnline: boolean;
  isLoading: boolean;
}

const POLL_INTERVAL_MS = 30000; // 30 seconds
const REQUEST_TIMEOUT_MS = 3000; // 3 seconds timeout

/**
 * Hook to check backend API health status
 * Polls every 30 seconds to check if backend is online
 * 
 * @returns {BackendStatus} Object with isOnline (boolean) and isLoading (boolean)
 */
export const useBackendStatus = (): BackendStatus => {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkBackendHealth = async (): Promise<void> => {
    // Get API base URL from environment
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
    
    // If no API URL configured, consider backend offline
    if (!apiBaseUrl) {
      setIsOnline(false);
      setIsLoading(false);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);

    try {
      // Try multiple endpoints in order of preference
      // Health endpoint is at root level (not under /api), so strip /api if present
      const baseWithoutApi = apiBaseUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
      const endpoints = [
        `${baseWithoutApi}/health`, // Try /health first (root level, not /api/health)
        `${apiBaseUrl.replace(/\/+$/, "")}/datasets?limit=1`, // Fallback to lightweight endpoint
      ];

      let success = false;

      // Try each endpoint until one succeeds
      for (const endpoint of endpoints) {
        let timeoutId: NodeJS.Timeout | null = null;
        try {
          // Create timeout controller
          timeoutId = setTimeout(() => {
            abortController.abort();
          }, REQUEST_TIMEOUT_MS);

          const response = await fetch(endpoint, {
            method: "GET",
            signal: abortController.signal,
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (timeoutId) clearTimeout(timeoutId);

          // If we get any response (even 404), backend is online
          if (response.status >= 200 && response.status < 500) {
            success = true;
            break;
          }
        } catch (error) {
          if (timeoutId) clearTimeout(timeoutId);
          // If it's an abort error, don't try next endpoint
          if (error instanceof Error && error.name === "AbortError") {
            return; // Component unmounted or new check started
          }
          // Otherwise, try next endpoint
          continue;
        }
      }

      // If all endpoints failed, try simple base URL check
      if (!success) {
        let timeoutId: NodeJS.Timeout | null = null;
        try {
          const baseUrl = apiBaseUrl.replace(/\/+$/, "");
          
          // Create timeout controller
          timeoutId = setTimeout(() => {
            abortController.abort();
          }, REQUEST_TIMEOUT_MS);

          const response = await fetch(baseUrl, {
            method: "GET",
            signal: abortController.signal,
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (timeoutId) clearTimeout(timeoutId);

          if (response.status >= 200 && response.status < 500) {
            success = true;
          }
        } catch (error) {
          if (timeoutId) clearTimeout(timeoutId);
          // Ignore errors - backend is offline
          if (error instanceof Error && error.name === "AbortError") {
            return; // Component unmounted
          }
        }
      }

      setIsOnline(success);
    } catch (error) {
      // Network error or timeout - backend is offline
      if (error instanceof Error && error.name === "AbortError") {
        return; // Component unmounted, don't update state
      }
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkBackendHealth();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      checkBackendHealth();
    }, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []); // Empty deps - only run on mount/unmount

  return { isOnline, isLoading };
};

