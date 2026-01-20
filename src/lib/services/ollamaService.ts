interface OllamaConfig {
  baseUrl?: string; // Default: http://localhost:11434
  model?: string; // Default: llama3
  timeout?: number; // Default: 90000ms (90 seconds - allows time for first model load)
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaService {
  private baseUrl: string;
  private model: string;
  private timeout: number;

  constructor(config?: OllamaConfig) {
    this.baseUrl = config?.baseUrl || "http://localhost:11434";
    this.model = config?.model || "llama3";
    this.timeout = config?.timeout || 90000; // 90 seconds - allows time for first model load
  }

  /**
   * Check if Ollama server is available
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Send chat completion request
   */
  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        stream: false
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Ollama API error: ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
    }

    const data: OllamaResponse = await response.json();
    return data.message.content;
  }

  /**
   * Stream chat completion (for real-time responses)
   */
  async *chatStream(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        stream: true
      }),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Ollama API error: ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response body");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            yield data.message.content;
          }
          if (data.done) return;
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}
