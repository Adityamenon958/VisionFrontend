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
 * Get authentication headers for API requests
 */
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
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

      // Retry on network errors
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
  });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    await supabase.auth.signOut();
    window.location.href = "/login";
    throw new Error("Unauthorized - please log in again");
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

    throw new Error(errorMessage);
  }

  return response.json();
};

