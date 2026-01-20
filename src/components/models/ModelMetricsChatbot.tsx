import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, X, Send, Bot, Square } from "lucide-react";
import { useAIChat, type AIProvider } from "@/hooks/useAIChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ProviderSelector } from "@/components/ai/ProviderSelector";

interface ModelMetricsChatbotProps {
  model: {
    modelId: string;
    modelType?: string;
    modelVersion?: string;
    metrics?: {
      bestEpoch?: number;
      bestLoss?: number;
      precision?: number;
      recall?: number;
      mAP50?: number;
      mAP50_95?: number;
    };
    insights?: {
      bestAccuracy?: number;
      bestmAP?: number;
      weakestLabels?: string[];
      classImbalanceWarnings?: string[];
      recommendations?: string[];
    };
    createdAt?: string;
  };
}

const SYSTEM_PROMPT = `You are an expert machine learning consultant specializing in computer vision and YOLO models. 
Your role is to analyze model training metrics and provide clear, actionable feedback to non-technical users.

Guidelines:
- Use simple, non-technical language
- Provide clear ratings: "Good", "Better", or "Best"
- Explain what each metric means in plain English
- Give specific recommendations for improvement
- Be encouraging but honest about model performance
- Format your response in a clear, structured way`;

export const ModelMetricsChatbot: React.FC<ModelMetricsChatbotProps> = ({ model }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [provider, setProvider] = useState<AIProvider>(() => {
    const stored = window.localStorage.getItem("aiProvider");
    return stored === "gemini" || stored === "ollama" ? stored : "ollama";
  });

  const buildMetricsContext = () => {
    return {
      epochs: model.metrics?.bestEpoch || 0,
      batchSize: 16,
      imageSize: 640,
      mAP: model.metrics?.mAP50 || 0,
      precision: model.metrics?.precision || 0,
      recall: model.metrics?.recall || 0,
      loss: model.metrics?.bestLoss || 0,
      device: "GPU",
      numClasses: 3,
    };
  };

  const {
    messages,
    isLoading,
    isAvailable,
    sendMessage,
    clearMessages,
    stop,
    lastProvider,
    isOllamaAvailable,
    isGeminiAvailable,
  } = useAIChat({
    provider,
    source: "training_details",
    contextBuilder: buildMetricsContext,
    systemPrompt: SYSTEM_PROMPT,
  });

  useEffect(() => {
    window.localStorage.setItem("aiProvider", provider);
  }, [provider]);

  const buildMetricsPrompt = () => {
    const metricsSummary = {
      modelInfo: {
        type: model.modelType || "Unknown",
        version: model.modelVersion || "Unknown",
        trainedAt: model.createdAt || "Unknown"
      },
      performance: {
        precision: model.metrics?.precision ? `${(model.metrics.precision * 100).toFixed(2)}%` : "N/A",
        recall: model.metrics?.recall ? `${(model.metrics.recall * 100).toFixed(2)}%` : "N/A",
        mAP50: model.metrics?.mAP50 ? `${(model.metrics.mAP50 * 100).toFixed(2)}%` : "N/A",
        mAP50_95: model.metrics?.mAP50_95 ? `${(model.metrics.mAP50_95 * 100).toFixed(2)}%` : "N/A",
        bestLoss: model.metrics?.bestLoss?.toFixed(4) || "N/A",
        bestEpoch: model.metrics?.bestEpoch || "N/A"
      },
      insights: {
        bestAccuracy: model.insights?.bestAccuracy ? `${(model.insights.bestAccuracy * 100).toFixed(2)}%` : null,
        bestmAP: model.insights?.bestmAP ? `${(model.insights.bestmAP * 100).toFixed(2)}%` : null,
        weakestLabels: model.insights?.weakestLabels || [],
        classImbalanceWarnings: model.insights?.classImbalanceWarnings || [],
        recommendations: model.insights?.recommendations || []
      }
    };

    return `Analyze this YOLO model's training results and provide feedback:

Model Information:
- Type: ${metricsSummary.modelInfo.type}
- Version: ${metricsSummary.modelInfo.version}
- Trained: ${metricsSummary.modelInfo.trainedAt}

Performance Metrics:
- Precision: ${metricsSummary.performance.precision}
- Recall: ${metricsSummary.performance.recall}
- mAP@0.5: ${metricsSummary.performance.mAP50}
- mAP@0.5-0.95: ${metricsSummary.performance.mAP50_95}
- Best Loss: ${metricsSummary.performance.bestLoss}
- Best Epoch: ${metricsSummary.performance.bestEpoch}

Additional Insights:
- Best Accuracy: ${metricsSummary.insights.bestAccuracy || "N/A"}
- Best mAP: ${metricsSummary.insights.bestmAP || "N/A"}
- Weakest Performing Labels: ${metricsSummary.insights.weakestLabels.length > 0 ? metricsSummary.insights.weakestLabels.join(", ") : "None"}
- Class Imbalance Issues: ${metricsSummary.insights.classImbalanceWarnings.length > 0 ? metricsSummary.insights.classImbalanceWarnings.join("; ") : "None"}

Please provide:
1. Overall assessment (Good/Better/Best)
2. What these metrics mean in simple terms
3. Whether this model is ready for production use
4. Specific recommendations for improvement (if any)
5. What the user should do next
6. Answer the questions in short and simple language`;
  };

  const handleAnalyze = async () => {
    if (!isAvailable) {
      return;
    }

    setHasAnalyzed(true);
    clearMessages();
    const prompt = buildMetricsPrompt();
    await sendMessage(prompt);
  };

  const handleSend = async () => {
    if (!userInput.trim() || isLoading || !isAvailable) return;

    const input = userInput.trim();
    setUserInput("");
    await sendMessage(input);
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (!hasAnalyzed && isAvailable) {
      // Auto-analyze when opening for the first time
      setTimeout(() => {
        void handleAnalyze();
      }, 100);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isAvailable && isAvailable !== null && messages.length === 0) {
    return (
      <div className="pt-3 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="h-4 w-4" />
          <span>AI analysis unavailable - please try again later</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          className="gap-2 w-full"
          disabled={isAvailable === false}
        >
          <MessageSquare className="h-4 w-4" />
          Ask AI About This Model
        </Button>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="flex flex-col sm:max-w-2xl w-full sm:w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Model Analysis Chat
            </SheetTitle>
            <SheetDescription>
              Get AI-powered analysis of your model metrics and recommendations
            </SheetDescription>
            <ProviderSelector
              provider={provider}
              onProviderChange={setProvider}
              isOllamaAvailable={isOllamaAvailable}
              isGeminiAvailable={isGeminiAvailable}
            />
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Click &quot;Analyze Model&quot; to get AI insights about this model&apos;s performance.
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0">
                      <Bot className="h-5 w-5 text-primary mt-1" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 max-w-[80%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    {message.role === "assistant" && lastProvider && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ({lastProvider === "gemini" ? "Gemini" : "Ollama"})
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex-shrink-0">
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs mt-1">
                        You
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0">
                    <Bot className="h-5 w-5 text-primary mt-1" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </div>
                  </div>
                </div>
              )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <div className="flex gap-2">
              <Textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask a follow-up question..."
                className="min-h-[60px] resize-none"
                disabled={isLoading || !isAvailable}
              />
              <Button
                onClick={handleSend}
                disabled={!userInput.trim() || isLoading || !isAvailable}
                size="icon"
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <SheetFooter className="flex-row justify-between items-center">
            <div className="flex gap-2">
              {isLoading ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stop}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={!isAvailable}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Analyze Model
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};
