import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { RequestItem } from "@/components/RequestItem";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface JoinRequestsSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminEmail: string;
  onRequestProcessed?: () => void;
}

interface JoinRequest {
  id: string;
  company_name: string;
  admin_email: string;
  status: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    email: string;
  } | null;
}

export const JoinRequestsSidePanel: React.FC<JoinRequestsSidePanelProps> = ({
  open,
  onOpenChange,
  adminEmail,
  onRequestProcessed,
}) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPendingRequests = async () => {
    if (!adminEmail) return;

    setLoading(true);
    try {
      // Fetch requests first
      const { data: requestsData, error: requestsError } = await supabase
        .from("workspace_join_requests")
        .select("*")
        .eq("admin_email", adminEmail)
        .in("status", ["pending", "email_sent"])
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;

      // Then fetch profiles for each request
      const requestsWithProfiles = await Promise.all(
        (requestsData || []).map(async (request) => {
          if (!request.user_id) return { ...request, profiles: null };

          const { data: profileData } = await supabase
            .from("profiles")
            .select("name, email")
            .eq("id", request.user_id)
            .maybeSingle();

          return {
            ...request,
            profiles: profileData,
          };
        })
      );

      setRequests(requestsWithProfiles);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      toast({
        title: "Error",
        description: "Failed to load join requests.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && adminEmail) {
      fetchPendingRequests();
    }
  }, [open, adminEmail]);

  const handleApproveRequest = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    setActionLoading(requestId);
    try {
      // 1. Update request status to approved
      const { error: updateError } = await supabase
        .from("workspace_join_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // 2. Get or find company
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("name", request.company_name)
        .eq("admin_email", request.admin_email)
        .maybeSingle();

      let companyId = existingCompany?.id;

      // 3. If company doesn't exist, create it
      if (!companyId) {
        // Get requester's email from their profile to set as admin
        const { data: requesterProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", request.user_id)
          .maybeSingle();

        // Get requester's email for admin_email - must have email to create company
        if (!requesterProfile?.email) {
          throw new Error("Requester email not found. Cannot create company.");
        }
        const requesterAdminEmail = requesterProfile.email;
        
        const { data: newCompany, error: companyError } = await supabase
          .from("companies")
          .insert({
            name: request.company_name,
            admin_email: requesterAdminEmail, // Use requester's email to ensure they are admin
            created_by: request.user_id, // Use created_by to match database schema
          })
          .select()
          .single();

        if (companyError) throw companyError;
        companyId = newCompany.id;
      }

      // 4. Update user's profile with company_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ company_id: companyId })
        .eq("id", request.user_id);

      if (profileError) throw profileError;

      // 5. Send approval email (optional - can be done via edge function)
      try {
        await supabase.functions.invoke("send-approval-email", {
          body: { requestId, userId: request.user_id },
        });
      } catch (emailError) {
        console.error("Error sending approval email:", emailError);
        // Don't fail the whole operation if email fails
      }

      toast({
        title: "Request approved",
        description: "The user has been added to the company.",
      });

      // Refresh requests list
      fetchPendingRequests();
      
      // Update badge count in Dashboard
      if (onRequestProcessed) {
        onRequestProcessed();
      }
    } catch (error: any) {
      console.error("Error approving request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve request.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    setActionLoading(requestId);
    try {
      // 1. Update request status to rejected
      const { error: updateError } = await supabase
        .from("workspace_join_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // 2. Send rejection email (optional - can be done via edge function)
      try {
        await supabase.functions.invoke("send-rejection-email", {
          body: { requestId, userId: request.user_id },
        });
      } catch (emailError) {
        console.error("Error sending rejection email:", emailError);
        // Don't fail the whole operation if email fails
      }

      toast({
        title: "Request rejected",
        description: "The join request has been rejected.",
      });

      // Refresh requests list
      fetchPendingRequests();
      
      // Update badge count in Dashboard
      if (onRequestProcessed) {
        onRequestProcessed();
      }
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject request.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Join Requests
            {requests.length > 0 && (
              <Badge variant="destructive">{requests.length}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No pending join requests
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {requests.map((request) => (
                <RequestItem
                  key={request.id}
                  request={request}
                  onApprove={handleApproveRequest}
                  onReject={handleRejectRequest}
                  loading={actionLoading === request.id}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

