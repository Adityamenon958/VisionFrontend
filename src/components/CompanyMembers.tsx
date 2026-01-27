// src/components/CompanyMembers.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isUserAdmin } from "@/lib/utils/adminUtils";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRole } from "@/lib/api/users";
import type { UserRole } from "@/types/roles";
import { Loader2 } from "lucide-react";
import { clearAuthCache } from "@/lib/api/config";

interface CompanyMembersProps {
  companyId: string;
  company: any;
  isAdmin: boolean;
  refreshTrigger?: number; // Optional trigger to force refresh
}

interface MemberProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  company_id: string;
  role?: string;
}

export const CompanyMembers: React.FC<CompanyMembersProps> = ({
  companyId,
  company,
  isAdmin,
  refreshTrigger,
}) => {
  const { userRole, hasPermission } = useProfile();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!hasPermission("manageWorkspaceUsers") || !companyId) {
      setLoading(false);
      return;
    }
    fetchMembers();
  }, [companyId, hasPermission, refreshTrigger]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("[CompanyMembers] Fetching members for company:", companyId);
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("id, name, email, phone, created_at, company_id, role")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("[CompanyMembers] Fetch error:", fetchError);
        throw fetchError;
      }

      console.log("[CompanyMembers] Fetched members:", data?.length || 0, data);
      setMembers(data || []);
    } catch (err: any) {
      console.error("[CompanyMembers] Error fetching company members:", err);
      setError(err?.message || "Failed to load company members");
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission("manageWorkspaceUsers")) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">You don't have permission to view company members.</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Map database role to display name
  const getRoleDisplayName = (role: string | undefined | null, memberEmail?: string): string => {
    if (!role) {
      // Fallback to email-based check (backward compatibility)
      if (company && memberEmail === company.admin_email) {
        return "Workspace Admin";
      }
      return "Viewer";
    }

    const roleMap: Record<string, string> = {
      platform_admin: "Platform Admin",
      workspace_admin: "Workspace Admin",
      ml_engineer: "ML Engineer",
      operator: "Operator",
      viewer: "Viewer",
      // Legacy roles (for backward compatibility)
      admin: "Workspace Admin",
      member: "Viewer",
    };

    return roleMap[role] || role;
  };

  // Get current user's role as UserRole type (for API calls)
  const getMemberRoleValue = (member: MemberProfile): UserRole => {
    if (!member.role) {
      // Fallback to email-based check
      if (company && member.email === company.admin_email) {
        return "workspace_admin";
      }
      return "viewer";
    }

    // Map legacy roles to new roles
    if (member.role === "admin") return "workspace_admin";
    if (member.role === "member") return "viewer";

    // Return as-is if it's already one of the 5 roles
    return member.role as UserRole;
  };

  // Check if current user can assign roles
  const canAssignRoles = hasPermission("assignRoles");

  // Handle role update
  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    if (!canAssignRoles) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to assign roles.",
        variant: "destructive",
      });
      return;
    }

    // Prevent workspace_admin from assigning platform_admin role
    if (userRole === "workspace_admin" && newRole === "platform_admin") {
      toast({
        title: "Permission denied",
        description: "Workspace admins cannot assign platform admin role.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingRoles((prev) => new Set(prev).add(memberId));

    try {
      await updateUserRole(memberId, newRole);

      // Clear auth cache to ensure fresh role data on next API call
      clearAuthCache();

      // Update local state
      setMembers((prevMembers) =>
        prevMembers.map((member) =>
          member.id === memberId ? { ...member, role: newRole } : member
        )
      );

      toast({
        title: "Role updated",
        description: `User role has been updated to ${getRoleDisplayName(newRole, undefined)}.`,
      });

      // Refresh members list to get latest data
      await fetchMembers();
    } catch (err: any) {
      console.error("[CompanyMembers] Error updating role:", err);
      toast({
        title: "Error updating role",
        description: err.message || "Failed to update user role. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingRoles((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading company members...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Company Members</h2>
        <p className="text-muted-foreground mt-1">
          View all members of your company and their details.
        </p>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No members found in this company.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-semibold">Name</th>
                <th className="text-left p-4 font-semibold">Phone</th>
                <th className="text-left p-4 font-semibold">Email</th>
                <th className="text-left p-4 font-semibold">Role</th>
                <th className="text-left p-4 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const currentRole = getMemberRoleValue(member);
                const isUpdating = updatingRoles.has(member.id);

                return (
                  <tr key={member.id} className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium">{member.name || "No name"}</td>
                    <td className="p-4">{member.phone || "Not provided"}</td>
                    <td className="p-4 text-muted-foreground">{member.email}</td>
                    <td className="p-4">
                      {canAssignRoles ? (
                        <div className="flex items-center gap-2">
                          <Select
                            value={currentRole}
                            onValueChange={(value) =>
                              handleRoleChange(member.id, value as UserRole)
                            }
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                              <SelectValue>
                                {isUpdating ? (
                                  <span className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Updating...
                                  </span>
                                ) : (
                                  getRoleDisplayName(member.role, member.email)
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {/* Only platform_admin can assign platform_admin role */}
                              {userRole === "platform_admin" && (
                                <SelectItem value="platform_admin">
                                  Platform Admin
                                </SelectItem>
                              )}
                              <SelectItem value="workspace_admin">
                                Workspace Admin
                              </SelectItem>
                              <SelectItem value="ml_engineer">ML Engineer</SelectItem>
                              <SelectItem value="operator">Operator</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary">
                          {getRoleDisplayName(member.role, member.email)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground text-sm">
                      {formatDate(member.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CompanyMembers;

