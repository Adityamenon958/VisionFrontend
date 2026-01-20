import { useState, useCallback } from "react";
import type { ChatMessage } from "@/lib/services/ollamaService";
import { askAI, type AISource } from "@/lib/api/ai";
import { useToast } from "@/hooks/use-toast";

interface UseGeminiChatOptions {
  provider: "ollama" | "gemini";
  source: AISource;
  contextBuilder: () => Record<string, unknown>;
  onError?: (error: Error) => void;
}

export const useGeminiChat = (options: UseGeminiChatOptions) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(true);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [lastProvider, setLastProvider] = useState<"ollama" | "gemini" | null>(null);
  const { toast } = useToast();

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * Stop current request
   */
  const stop = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  }, [abortController]);

  const sendMessage = useCallback(
    async (question: string): Promise<string> => {
      if (!question.trim()) {
        throw new Error("Question is required");
      }

      // Create abort controller for this request
      const controller = new AbortController();
      setAbortController(controller);

      setIsLoading(true);
      const userMsg: ChatMessage = { role: "user", content: question };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const context = options.contextBuilder();

        const response = await askAI({
          provider: options.provider,
          source: options.source,
          question,
          context,
        }, controller.signal);

        // Check if aborted
        if (controller.signal.aborted) {
          // Remove incomplete assistant message if any
          setMessages((prev) => prev.filter((msg, idx) => !(idx === prev.length - 1 && msg.role === "assistant" && !msg.content)));
          throw new Error("Request cancelled by user");
        }

        // Track which provider actually answered
        setLastProvider(response.provider);
        
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: response.answer,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsAvailable(true);
        setAbortController(null);
        return response.answer;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        
        // Don't show error toast if user cancelled
        if (err.message.includes("cancelled") || controller.signal.aborted) {
          setAbortController(null);
          setIsLoading(false);
          return "";
        }

        setIsAvailable(false);

        options.onError?.(err);
        toast({
          title: "AI assistant error",
          description: "The AI assistant is currently unavailable. Please try again later.",
          variant: "destructive",
        });
        throw err;
      } finally {
        setAbortController(null);
        setIsLoading(false);
      }
    },
    [options, toast, abortController]
  );

  return {
    messages,
    isLoading,
    isAvailable,
    sendMessage,
    clearMessages,
    stop,
    lastProvider,
  };
};
