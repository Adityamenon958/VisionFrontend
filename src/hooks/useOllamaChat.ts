import { useState, useCallback, useEffect } from "react";
import { OllamaService, ChatMessage } from "@/lib/services/ollamaService";
import { useToast } from "@/hooks/use-toast";

interface UseOllamaChatOptions {
  systemPrompt?: string;
  onError?: (error: Error) => void;
}

export const useOllamaChat = (options?: UseOllamaChatOptions) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const { toast } = useToast();

  const baseUrl = (import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434").trim();
  const model = (import.meta.env.VITE_OLLAMA_MODEL || "llama3").trim();

  const ollama = new OllamaService({
    baseUrl,
    model,
    timeout: 120000,
  });

  const checkConnection = useCallback(async () => {
    try {
      const connected = await ollama.checkConnection();
      setIsConnected(connected);
      if (!connected) {
        toast({
          title: "Ollama not available",
          description: "Please make sure Ollama is running on your machine (http://localhost:11434).",
          variant: "destructive",
        });
      }
      return connected;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, [toast, ollama]);

  // Check connection on mount
  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  /**
   * Non-streaming message send (kept for compatibility)
   */
  const sendMessage = useCallback(
    async (userMessage: string) => {
      // Check connection if not already checked
      if (isConnected === null || isConnected === false) {
        const connected = await checkConnection();
        if (!connected) {
          throw new Error("Ollama server is not available. Please start Ollama on your machine.");
        }
      }

      setIsLoading(true);
      const userMsg: ChatMessage = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const allMessages: ChatMessage[] = [
          ...(options?.systemPrompt ? [{ role: "system" as const, content: options.systemPrompt }] : []),
          ...messages,
          userMsg,
        ];

        const response = await ollama.chat(allMessages);
        const assistantMsg: ChatMessage = { role: "assistant", content: response };
        setMessages((prev) => [...prev, assistantMsg]);
        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");

        // Provide more helpful error messages for timeout
        let errorMessage = err.message;
        if (err.message.includes("timeout") || err.message.includes("TimeoutError")) {
          errorMessage = "Request timed out. The model may be loading for the first time. Please try again in a moment.";
        }

        options?.onError?.(err);
        toast({
          title: "Chat error",
          description: errorMessage,
          variant: "destructive",
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isConnected, messages, options, checkConnection, toast, ollama]
  );

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

  /**
   * Streaming message send - returns full assistant response but updates messages incrementally.
   */
  const sendMessageStream = useCallback(
    async (userMessage: string) => {
      // Check connection if not already checked
      if (isConnected === null || isConnected === false) {
        const connected = await checkConnection();
        if (!connected) {
          throw new Error("Ollama server is not available. Please start Ollama on your machine.");
        }
      }

      // Create abort controller for this request
      const controller = new AbortController();
      setAbortController(controller);

      setIsLoading(true);
      const userMsg: ChatMessage = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const baseMessages: ChatMessage[] = [
          ...(options?.systemPrompt ? [{ role: "system" as const, content: options.systemPrompt }] : []),
          ...messages,
          userMsg,
        ];

        // Start with an empty assistant message
        let assistantContent = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        for await (const chunk of ollama.chatStream(baseMessages, controller.signal)) {
          // Check if aborted
          if (controller.signal.aborted) {
            // Remove incomplete assistant message
            setMessages((prev) => prev.filter((msg, idx) => !(idx === prev.length - 1 && msg.role === "assistant" && !msg.content)));
            throw new Error("Request cancelled by user");
          }
          assistantContent += chunk;
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            const last = updated[lastIndex];
            if (last && last.role === "assistant") {
              updated[lastIndex] = { ...last, content: assistantContent };
            }
            return updated;
          });
        }

        setAbortController(null);
        return assistantContent;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");

        // Don't show error toast if user cancelled
        if (err.message.includes("cancelled") || controller.signal.aborted) {
          setAbortController(null);
          setIsLoading(false);
          return "";
        }

        let errorMessage = err.message;
        if (err.message.includes("timeout") || err.message.includes("TimeoutError")) {
          errorMessage = "Request timed out. The model may be loading for the first time. Please try again in a moment.";
        }

        options?.onError?.(err);
        toast({
          title: "Chat error",
          description: errorMessage,
          variant: "destructive",
        });
        throw err;
      } finally {
        setAbortController(null);
        setIsLoading(false);
      }
    },
    [isConnected, messages, options, checkConnection, toast, ollama]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    isConnected,
    sendMessage,
    sendMessageStream,
    clearMessages,
    checkConnection,
    stop,
  };
};
