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
  const { toast } = useToast();

  const baseUrl = (import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434").trim();
  const model = (import.meta.env.VITE_OLLAMA_MODEL || "llama3").trim();

  const ollama = new OllamaService({
    baseUrl,
    model
  });

  const checkConnection = useCallback(async () => {
    try {
      const connected = await ollama.checkConnection();
      setIsConnected(connected);
      if (!connected) {
        toast({
          title: "Ollama not available",
          description: "Please make sure Ollama is running on your machine (http://localhost:11434).",
          variant: "destructive"
        });
      }
      return connected;
    } catch (error) {
      setIsConnected(false);
      return false;
    }
  }, [toast]);

  // Check connection on mount
  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const sendMessage = useCallback(async (userMessage: string) => {
    // Check connection if not already checked
    if (isConnected === null || isConnected === false) {
      const connected = await checkConnection();
      if (!connected) {
        throw new Error("Ollama server is not available. Please start Ollama on your machine.");
      }
    }

    setIsLoading(true);
    const userMsg: ChatMessage = { role: "user", content: userMessage };
    setMessages(prev => [...prev, userMsg]);

    try {
      const allMessages: ChatMessage[] = [
        ...(options?.systemPrompt ? [{ role: "system" as const, content: options.systemPrompt }] : []),
        ...messages,
        userMsg
      ];

      const response = await ollama.chat(allMessages);
      const assistantMsg: ChatMessage = { role: "assistant", content: response };
      setMessages(prev => [...prev, assistantMsg]);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      options?.onError?.(err);
      toast({
        title: "Chat error",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, messages, options, checkConnection, toast, ollama]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    isConnected,
    sendMessage,
    clearMessages,
    checkConnection
  };
};
