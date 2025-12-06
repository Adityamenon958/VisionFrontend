import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ROUTE_STORAGE_KEY = "visionm_last_route";

/**
 * Hook to persist and restore the current route on page refresh
 * Saves route to localStorage and restores it after session hydration
 */
export const useRoutePersistence = (isSessionReady: boolean) => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasRestored = useRef(false);

  // Save route to localStorage on navigation changes (only for app routes)
  useEffect(() => {
    const isAppRoute = location.pathname.startsWith("/dashboard") || 
                      location.pathname.startsWith("/account") ||
                      location.pathname.startsWith("/dataset");
    
    if (isAppRoute && location.pathname !== "/auth") {
      try {
        localStorage.setItem(ROUTE_STORAGE_KEY, location.pathname + location.search);
      } catch (error) {
        console.warn("Failed to save route to localStorage:", error);
      }
    }
  }, [location]);

  // Restore route after session is ready (only once)
  useEffect(() => {
    if (!isSessionReady || hasRestored.current) return;

    try {
      const savedRoute = localStorage.getItem(ROUTE_STORAGE_KEY);
      const currentRoute = location.pathname + location.search;
      
      if (savedRoute && savedRoute !== currentRoute) {
        // Only restore if we're on a default route (dashboard) or landing
        if (location.pathname === "/dashboard" && !location.search) {
          hasRestored.current = true;
          navigate(savedRoute, { replace: true });
        }
      } else {
        hasRestored.current = true;
      }
    } catch (error) {
      console.warn("Failed to restore route from localStorage:", error);
      hasRestored.current = true;
    }
  }, [isSessionReady, location.pathname, location.search, navigate]);

  return null;
};

