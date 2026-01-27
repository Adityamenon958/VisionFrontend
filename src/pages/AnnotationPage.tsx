import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AnnotationWorkspace } from "@/components/annotation/AnnotationWorkspace";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/pages/EmptyState";
import { Lock } from "lucide-react";

export const AnnotationPage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const { hasPermission, loading: profileLoading } = useProfile();
  const { toast } = useToast();

  // Check permission on mount
  useEffect(() => {
    if (!profileLoading && !hasPermission("annotateDatasets")) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to annotate datasets.",
        variant: "destructive",
      });
      navigate("/dashboard?view=simulation", { replace: true });
    }
  }, [hasPermission, profileLoading, navigate, toast]);

  if (!datasetId) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Dataset ID is required.</p>
      </div>
    );
  }

  // Show loading or access denied if no permission
  if (profileLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!hasPermission("annotateDatasets")) {
    return (
      <div className="p-8">
        <EmptyState
          icon={Lock}
          title="Access Denied"
          description="You don't have permission to annotate datasets. Please contact your workspace administrator."
        />
      </div>
    );
  }

  const handleClose = () => {
    // Navigate back to simulation page
    navigate("/dashboard?view=simulation");
  };

  return (
    <div className="p-4">
      <AnnotationWorkspace datasetId={datasetId} onClose={handleClose} />
    </div>
  );
};
