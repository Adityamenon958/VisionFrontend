import { supabase } from "@/integrations/supabase/client";

/**
 * API base URL from environment variable
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim();

/**
 * Construct API URL from path
 */
export const apiUrl = (path: string): string => {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return base ? `${base}/${p}` : `/${p}`;
};

/**
 * Cache for user profile data to avoid repeated Supabase calls
 */
interface CachedProfile {
  id: string;
  email: string;
  role: string;
  company_id: string | null;
  company: string | null;
  timestamp: number;
}

let cachedProfile: CachedProfile | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the authentication cache
 * Call this after profile updates, role changes, etc.
 */
export const clearAuthCache = () => {
  cachedProfile = null;
};

/**
 * Get authentication headers for API requests
 * Includes user information in custom headers for backend authentication
 */
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  try {
    // Get Supabase session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Not authenticated");
    }

    const token = session?.access_token;
    const userId = session.user.id;

    // Check cache
    const now = Date.now();
    if (cachedProfile && (now - cachedProfile.timestamp) < CACHE_DURATION) {
      // Use cached data
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-User-Id": cachedProfile.id,
        "X-User-Role": cachedProfile.role,
        "X-User-Email": cachedProfile.email,
      };

      if (cachedProfile.company_id) {
        headers["X-User-Company-Id"] = cachedProfile.company_id;
      }
      // Always send X-User-Company (required by backend, empty string if no company)
      headers["X-User-Company"] = cachedProfile.company || "";

      return headers;
    }

    // Fetch fresh profile data
    let profile: any = null;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, company_id")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        profile = data;
      }
    } catch (profileError) {
      console.warn("[getAuthHeaders] Could not fetch profile:", profileError);
      // Continue with session data only
    }

    // Get company name if company_id exists
    let companyName: string | null = null;
    if (profile?.company_id) {
      try {
        const { data: companyData } = await supabase
          .from("companies")
          .select("name")
          .eq("id", profile.company_id)
          .maybeSingle();

        companyName = companyData?.name || null;
      } catch (companyError) {
        console.warn("[getAuthHeaders] Could not fetch company:", companyError);
        // Continue without company name
      }
    }

    // Update cache
    if (profile) {
      cachedProfile = {
        id: profile.id || userId,
        email: profile.email || session.user.email || "",
        role: profile.role || "viewer",
        company_id: profile.company_id || null,
        company: companyName,
        timestamp: now,
      };
    } else {
      // Cache fallback data
      cachedProfile = {
        id: userId,
        email: session.user.email || "",
        role: "viewer",
        company_id: null,
        company: null,
        timestamp: now,
      };
    }

    // Build headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };

    if (profile) {
      headers["X-User-Id"] = profile.id || userId;
      headers["X-User-Role"] = profile.role || "viewer";
      headers["X-User-Email"] = profile.email || session.user.email || "";

      if (profile.company_id) {
        headers["X-User-Company-Id"] = profile.company_id;
      }
      // Always send X-User-Company (required by backend, empty string if no company)
      headers["X-User-Company"] = companyName || "";
    } else {
      // Fallback if profile fetch fails
      headers["X-User-Id"] = userId;
      headers["X-User-Email"] = session.user.email || "";
      headers["X-User-Role"] = "viewer";
      // Always send X-User-Company (required by backend)
      headers["X-User-Company"] = "";
    }

    return headers;
  } catch (error) {
    console.error("[getAuthHeaders] Error:", error);
    // Return minimal headers to prevent complete failure
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      "Content-Type": "application/json",
      "Authorization": session?.access_token ? `Bearer ${session.access_token}` : "",
      "X-User-Id": session?.user?.id || "",
      "X-User-Role": "viewer",
      "X-User-Email": session?.user?.email || "",
      "X-User-Company": "", // Always send (required by backend)
    };
  }
};

/**
 * Handle API errors
 */
export const handleApiError = (error: unknown): never => {
  if (error instanceof Error) {
    throw error;
  }
  throw new Error("An unknown error occurred");
};

/**
 * Fetch with retry logic for transient failures
 */
export const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx errors or network errors
      if (response.status >= 500 && attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Network error");
      
      // Don't retry on connection refused errors - backend is likely not running
      if (error instanceof TypeError && 
          (error.message.includes("Failed to fetch") || 
           error.message.includes("ERR_CONNECTION_REFUSED"))) {
        throw lastError; // Fail immediately for connection errors
      }

      // Retry on other network errors
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
};

/**
 * Make authenticated API request
 */
export const apiRequest = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const headers = await getAuthHeaders();
  const url = apiUrl(path);

  console.log(`[apiRequest] ${options.method || "GET"} ${url}`);

  // Don't override Content-Type for FormData
  const requestHeaders: HeadersInit = { ...headers };
  if (!(options.body instanceof FormData)) {
    Object.assign(requestHeaders, options.headers);
  } else {
    // For FormData, only add auth header, let browser set Content-Type
    delete requestHeaders["Content-Type"];
    if (headers["Authorization"]) {
      requestHeaders["Authorization"] = headers["Authorization"];
    }
  }

  const response = await fetchWithRetry(url, {
    ...options,
    headers: requestHeaders,
    signal: options.signal, // Pass through abort signal
  });

  console.log(`[apiRequest] Response status: ${response.status} for ${url}`);

  // Handle 401 Unauthorized
  if (response.status === 401) {
    // Check if session is still valid
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Session expired, redirect to login
      clearAuthCache();
      await supabase.auth.signOut();
      window.location.href = "/login";
      throw new Error("Unauthorized - please log in again");
    }

    // Try to refresh session
    const { data: { session: newSession }, error: refreshError } =
      await supabase.auth.refreshSession();

    if (newSession && !refreshError) {
      // Session refreshed, clear cache
      clearAuthCache();
      // Throw error to let caller handle retry if needed
      throw new Error("Session refreshed - please retry");
    } else {
      // Refresh failed, redirect to login
      clearAuthCache();
      await supabase.auth.signOut();
      window.location.href = "/login";
      throw new Error("Unauthorized - please log in again");
    }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let errorMessage = `HTTP ${response.status}`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorJson.message || errorMessage;
    } catch {
      if (errorText) {
        errorMessage = errorText;
      }
    }

    console.error(`[apiRequest] Error ${response.status} for ${url}:`, errorMessage);
    throw new Error(errorMessage);
  }

  const json = await response.json();
  return json;
};

