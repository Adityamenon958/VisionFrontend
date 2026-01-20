import React from "react";
import { Button } from "@/components/ui/button";
import type { AIProvider } from "@/hooks/useAIChat";

interface ProviderSelectorProps {
  provider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  isOllamaAvailable: boolean | null;
  isGeminiAvailable: boolean | null;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  provider,
  onProviderChange,
  isOllamaAvailable,
  isGeminiAvailable,
}) => {
  return (
    <div className="mt-2 flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">AI Provider</span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={provider === "ollama" ? "default" : "outline"}
          size="xs"
          onClick={() => onProviderChange("ollama")}
          disabled={isOllamaAvailable === false}
        >
          Ollama
        </Button>
        <Button
          type="button"
          variant={provider === "gemini" ? "default" : "outline"}
          size="xs"
          onClick={() => onProviderChange("gemini")}
          disabled={isGeminiAvailable === false}
        >
          Gemini
        </Button>
      </div>
    </div>
  );
};
