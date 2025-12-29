import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Building2, Menu, CheckCircle2, XCircle, Sun, Moon } from "lucide-react";
import { UserMenu } from "./UserMenu";
import { JoinCompanyDialog } from "@/components/JoinCompanyDialog";
import { JoinRequestsSidePanel } from "@/components/JoinRequestsSidePanel";
import { useProfile } from "@/hooks/useProfile";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isAdmin, company, loading, sessionReady } = useProfile();
  const { isOnline, isLoading: backendStatusLoading } = useBackendStatus();
  const { theme, toggleTheme } = useTheme();
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  // Debug admin status in development (only when session is fully initialized)
  useEffect(() => {
    if (import.meta.env.DEV && sessionReady && !loading) {
      console.log("[AppHeader] Admin Status Check:", {
        hasProfile: !!profile,
        hasCompany: !!company,
        profileEmail: profile?.email,
        companyAdminEmail: company?.admin_email,
        companyFromProfile: profile?.companies?.admin_email,
        emailsMatch: profile?.email === company?.admin_email,
        emailsMatchWithProfile: profile?.email === profile?.companies?.admin_email,
        isAdmin,
        shouldShowBell: isAdmin && profile?.email,
        shouldShowPanel: isAdmin && profile?.email,
        loading,
        sessionReady,
      });
    }
  }, [profile, company, isAdmin, loading, sessionReady]);

  // Poll for pending requests (every 30 seconds) if admin
  useEffect(() => {
    if (profile && isAdmin && profile.email) {
      fetchPendingRequestCount();
      const interval = setInterval(fetchPendingRequestCount, 30000);
      return () => clearInterval(interval);
    } else {
      setPendingRequestCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isAdmin]);

  const fetchPendingRequestCount = async () => {
    if (!profile || !isAdmin || !profile.email) {
      setPendingRequestCount(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from("workspace_join_requests")
        .select("*", { count: "exact", head: true })
        .eq("admin_email", profile.email)
        .in("status", ["pending", "email_sent"]);

      if (error) throw error;
      setPendingRequestCount(count || 0);
    } catch (error) {
      console.error("Error fetching pending request count:", error);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-colors duration-300 ease-in-out shadow-sm dark:shadow-none">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Left: Mobile Menu + Logo */}
          <div className="flex items-center gap-2">
            {/* Mobile Menu Sheet */}
            {isMobile && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setMobileMenuOpen(true);
                      }
                    }}
                    aria-label="Open menu"
                    aria-expanded={mobileMenuOpen}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
                </SheetContent>
              </Sheet>
            )}

            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate("/dashboard")}
            >
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-primary">VisionM</span>
              {profile?.companies?.name && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                  {profile.companies.name}
                </span>
              )}
            </div>
          </div>

          {/* Center: Backend Status Indicator */}
          <div className="hidden md:flex items-center gap-4" role="status" aria-live="polite">
            {!backendStatusLoading && (
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <span 
                    className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400"
                    aria-label="Backend status: Online"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Backend: Online</span>
                  </span>
                ) : (
                  <span 
                    className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                    aria-label="Backend status: Offline"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Backend: Offline</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {!profile?.company_id && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/dashboard?action=create-company")}
                >
                  Create Company
                </Button>
                <JoinCompanyDialog />
              </>
            )}

            {/* Icon Group */}
            <div className="flex items-center gap-1 bg-muted/30 dark:bg-muted/20 rounded-lg px-2 py-1">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="hover:bg-muted rounded-full"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>

              {/* Notification Bell Icon - Admin Only */}
              {sessionReady && !loading && isAdmin && profile?.email && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative hover:bg-muted rounded-full"
                  onClick={() => setShowRequestsPanel(true)}
                  title="Join Requests"
                >
                  <Bell className="h-5 w-5" />
                  {pendingRequestCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {pendingRequestCount}
                    </Badge>
                  )}
                </Button>
              )}

              {/* User Menu */}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Join Requests Side Panel - Admin Only */}
      {sessionReady && !loading && isAdmin && profile?.email && (
        <JoinRequestsSidePanel
          open={showRequestsPanel}
          onOpenChange={setShowRequestsPanel}
          adminEmail={profile.email}
          onRequestProcessed={fetchPendingRequestCount}
        />
      )}
    </>
  );
};

