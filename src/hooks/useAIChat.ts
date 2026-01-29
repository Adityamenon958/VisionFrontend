import { useMemo } from "react";
import { useGeminiChat } from "@/hooks/useGeminiChat";
import type { AISource } from "@/lib/api/ai";

export type AIProvider = "gemini";

interface UseAIChatOptions {
  provider: AIProvider;
  source: AISource;
  contextBuilder: () => Record<string, unknown>;
  systemPrompt?: string;
  onError?: (error: Error) => void;
}

export const useAIChat = (options: UseAIChatOptions) => {
  const geminiChat = useGeminiChat({
    provider: options.provider,
    source: options.source,
    contextBuilder: options.contextBuilder,
    onError: options.onError,
  });

  const active = useMemo(
    () => ({
      provider: "gemini" as AIProvider,
      messages: geminiChat.messages,
      isLoading: geminiChat.isLoading,
      isAvailable: geminiChat.isAvailable,
      sendMessage: geminiChat.sendMessage,
      clearMessages: geminiChat.clearMessages,
      stop: geminiChat.stop,
      lastProvider: geminiChat.lastProvider,
    }),
    [geminiChat]
  );

  return {
    ...active,
    isGeminiAvailable: geminiChat.isAvailable,
  };
};
