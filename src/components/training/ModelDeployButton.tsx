import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import { DeployModelModal } from "@/components/models/DeployModelModal";

interface ModelDeployButtonProps {
  modelId: string;
  modelName: string;
  onDeployStart?: () => void;
  onDeployComplete?: () => void;
  onDeployError?: (error: Error) => void;
}

export const ModelDeployButton: React.FC<ModelDeployButtonProps> = ({
  modelId,
  modelName,
  onDeployStart,
  onDeployComplete,
  onDeployError,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDeploy = async (deviceIp: string, folderPath: string) => {
    onDeployStart?.();
    try {
      // Deployment is handled by the modal, this is just for callbacks
      onDeployComplete?.();
    } catch (error) {
      onDeployError?.(error instanceof Error ? error : new Error("Deployment failed"));
    }
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="gap-2"
      >
        <Rocket className="h-4 w-4" />
        Deploy Model
      </Button>

      <DeployModelModal
        modelId={modelId}
        modelName={modelName}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDeploy={handleDeploy}
      />
    </>
  );
};
