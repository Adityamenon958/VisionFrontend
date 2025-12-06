import React from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { PageHeader } from "@/components/pages/PageHeader";
import { EmptyState } from "@/components/pages/EmptyState";
import { LoadingState } from "@/components/pages/LoadingState";
import { CompanyMembers } from "@/components/CompanyMembers";
import { Users } from "lucide-react";

export const TeamMembersPage: React.FC = () => {
  const { profile, isAdmin, loading } = useProfile();

  if (loading) {
    return <LoadingState message="Loading team members..." />;
  }

  if (!profile?.company_id) {
    return (
      <div>
        <PageHeader title="Team Members" description="Manage your workspace team" />
        <EmptyState
          icon={Users}
          title="No workspace"
          description="You need to be part of a workspace to view team members."
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Team Members" description="Manage your workspace team" />
        <EmptyState
          icon={Users}
          title="Access restricted"
          description="Only workspace admins can view team members."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team Members"
        description="View and manage members of your workspace"
      />
      <CompanyMembers
        companyId={profile.company_id}
        company={profile.companies}
        isAdmin={isAdmin}
      />
    </div>
  );
};

