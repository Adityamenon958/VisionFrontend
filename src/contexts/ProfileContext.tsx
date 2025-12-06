/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isUserAdmin } from "@/lib/utils/adminUtils";

interface ProfileContextType {
  profile: any | null;
  company: any | null;
  isAdmin: boolean;
  loading: boolean;
  user: any | null;
  sessionReady: boolean; // New: indicates if session has been checked
  error: string | null; // New: error state
  reloadProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider = ({ children }: ProfileProviderProps) => {
  const isDev = import.meta.env.DEV;
  const [profile, setProfile] = useState<any | null>(null);
  const [company, setCompany] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile only after session is confirmed
  const loadProfile = useCallback(async (session: any) => {
    const isDev = import.meta.env.DEV;
    if (!session?.user?.id) {
      if (isDev) {
        console.log("[ProfileContext] No session.user.id, skipping profile fetch");
      }
      setUser(null);
      setProfile(null);
      setCompany(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userId = session.user.id;

      if (isDev) {
        console.log("[ProfileContext] Fetching profile for user:", userId);
      }

      // Fetch profile - Supabase client automatically includes Authorization header
      const profilePromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      const { data: profileData, error: profileError } = await profilePromise;

      if (profileError) {
        throw profileError;
      }

      if (!profileData) {
        if (isDev) {
          console.log("[ProfileContext] Profile not found for user:", userId);
        }
        setProfile(null);
        setCompany(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Set profile immediately (optimistic update)
      setProfile(profileData);
      setCompany(null);
      setIsAdmin(false);

      // If company_id exists, fetch company in parallel (already have profile)
      if (profileData.company_id) {
        // Fetch company - this can happen in parallel with profile update
        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("*")
          .eq("id", profileData.company_id)
          .maybeSingle();

        if (companyError) {
          console.error("Error loading company:", companyError);
        }

        if (companyData) {
          setCompany(companyData);
          const adminStatus = isUserAdmin(profileData, companyData);
          setIsAdmin(adminStatus);
          // Update profile with nested company (consistent with Dashboard structure)
          setProfile({ ...profileData, companies: companyData });
          
          if (isDev) {
            console.log("[ProfileContext] Profile loaded successfully:", {
              hasProfile: !!profileData,
              hasCompany: !!profileData?.company_id,
              isAdmin: adminStatus,
            });
          }
        } else {
          // Company not found, but profile is already set
          if (isDev) {
            console.log("[ProfileContext] Profile loaded, company not found:", {
              hasProfile: !!profileData,
              hasCompany: false,
              isAdmin: false,
            });
          }
        }
      } else {
        if (isDev) {
          console.log("[ProfileContext] Profile loaded successfully:", {
            hasProfile: !!profileData,
            hasCompany: false,
            isAdmin: false,
          });
        }
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      setError(error?.message || "Failed to load profile");
      setProfile(null);
      setCompany(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Explicitly hydrate session on mount
  useEffect(() => {
    let mounted = true;

    const hydrateSession = async () => {
      try {
        setError(null);
        // Don't set loading=true here - getSession() is instant from localStorage
        // Only set loading when we actually start fetching profile

        // Step 1: Get session from localStorage (instant operation)
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (isDev) {
          console.log("[ProfileContext] getSession() result:", {
            hasSession: !!session,
            userId: session?.user?.id,
            email: session?.user?.email,
          });
        }

        if (!mounted) return;

        if (!session) {
          setUser(null);
          setProfile(null);
          setCompany(null);
          setIsAdmin(false);
          setSessionReady(true);
          setLoading(false);
          if (isDev) {
            console.log("[ProfileContext] No session found, session ready");
          }
          return;
        }

        // Step 2: Set user from session immediately (optimistic update)
        setUser(session.user);
        setSessionReady(true);

        // Step 3: Fetch profile only after session is confirmed
        await loadProfile(session);
      } catch (error: any) {
        console.error("Error hydrating session:", error);
        setError(error?.message || "Failed to restore session");
        setUser(null);
        setProfile(null);
        setCompany(null);
        setIsAdmin(false);
        setSessionReady(true);
        setLoading(false);
      }
    };

    hydrateSession();

    // Listen for auth state changes (for cross-tab sync and token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      const isDev = import.meta.env.DEV;
      if (isDev) {
        console.log("[ProfileContext] Auth state change:", event, {
          hasSession: !!session,
          userId: session?.user?.id,
        });
      }

      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setProfile(null);
        setCompany(null);
        setIsAdmin(false);
        setSessionReady(true);
        setLoading(false);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setUser(session.user);
        setSessionReady(true);
        await loadProfile(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        company,
        isAdmin,
        loading,
        user,
        sessionReady,
        error,
        reloadProfile: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await loadProfile(session);
          }
        },
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

