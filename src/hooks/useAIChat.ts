import { useMemo } from "react";
import type { ChatMessage } from "@/lib/services/ollamaService";
import { useOllamaChat } from "@/hooks/useOllamaChat";
import { useGeminiChat } from "@/hooks/useGeminiChat";
import type { AISource } from "@/lib/api/ai";

export type AIProvider = "ollama" | "gemini";

interface UseAIChatOptions {
  provider: AIProvider;
  source: AISource;
  contextBuilder: () => Record<string, unknown>;
  systemPrompt?: string;
  onError?: (error: Error) => void;
}

export const useAIChat = (options: UseAIChatOptions) => {
  const ollamaChat = useOllamaChat({
    systemPrompt: options.systemPrompt,
    onError: options.onError,
  });

  const geminiChat = useGeminiChat({
    provider: options.provider,
    source: options.source,
    contextBuilder: options.contextBuilder,
    onError: options.onError,
  });

  const active = useMemo(() => {
    if (options.provider === "ollama") {
      return {
        provider: "ollama" as AIProvider,
        messages: ollamaChat.messages as ChatMessage[],
        isLoading: ollamaChat.isLoading,
        isAvailable: ollamaChat.isConnected ?? null,
        sendMessage: ollamaChat.sendMessageStream,
        clearMessages: ollamaChat.clearMessages,
        stop: ollamaChat.stop,
      };
    }

    return {
      provider: "gemini" as AIProvider,
      messages: geminiChat.messages,
      isLoading: geminiChat.isLoading,
      isAvailable: geminiChat.isAvailable,
      sendMessage: geminiChat.sendMessage,
      clearMessages: geminiChat.clearMessages,
      stop: geminiChat.stop,
      lastProvider: geminiChat.lastProvider,
    };
  }, [options.provider, ollamaChat, geminiChat]);

  return {
    ...active,
    isOllamaAvailable: ollamaChat.isConnected,
    isGeminiAvailable: geminiChat.isAvailable,
  };
};
