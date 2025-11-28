/**import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import DatasetManager from "./DatasetManager";

/**
 * Wrapper page for managing datasets for a specific project.
 * Route: /dataset/:id
 */
/**const DatasetPage = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // If there is no :id in the URL, show error + redirect
  useEffect(() => {
    if (!id) {
      toast({
        title: "Invalid URL",
        description: "Project ID is missing.",
        variant: "destructive",
      });

      // Send user back to dashboard
      navigate("/dashboard");
    }
  }, [id, navigate, toast]);

  // While redirecting, render nothing
  if (!id) {
    return null;
  }

  // Your existing dataset manager page (unchanged)
  return <DatasetManager />;
};

export default DatasetPage;*/