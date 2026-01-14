import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AnnotationWorkspace } from "@/components/annotation/AnnotationWorkspace";

export const AnnotationPage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();

  if (!datasetId) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Dataset ID is required.</p>
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
