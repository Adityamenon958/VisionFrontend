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
import { Loader2, Sparkles, X, Send, Bot, Check, Square } from "lucide-react";
import { useAIChat, type AIProvider } from "@/hooks/useAIChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { HyperparametersSnapshot } from "@/utils/trainingPersistence";
import { ProviderSelector } from "@/components/ai/ProviderSelector";

interface HyperparametersChatbotProps {
  datasetInfo: {
    datasetId: string;
    totalImages?: number;
    labeledImages?: number;
    unlabeledImages?: number;
    version?: string;
    status?: string;
  };
  modelType: "YOLO" | "EfficientNet" | "Custom";
  currentParams?: {
    epochs?: number;
    batchSize?: number;
    imgSize?: number;
    learningRate?: number;
    workers?: number;
  };
  onParamsSuggested?: (params: HyperparametersSnapshot) => void;
}

const SYSTEM_PROMPT = `You are an expert machine learning engineer specializing in computer vision model training. 
Your role is to suggest optimal hyperparameters for YOLO model training based on dataset characteristics.

Guidelines:
- Consider dataset size, labeled vs unlabeled ratio
- Suggest parameters that balance training time and model performance
- Provide reasoning for each parameter suggestion
- Consider computational resources (batch size, workers)
- Use industry best practices for YOLO training
- Respond with a clear explanation followed by JSON format for the suggested parameters`;

export const HyperparametersChatbot: React.FC<HyperparametersChatbotProps> = ({
  datasetInfo,
  modelType,
  currentParams,
  onParamsSuggested
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [suggestedParams, setSuggestedParams] = useState<HyperparametersSnapshot | null>(null);
  const [provider, setProvider] = useState<AIProvider>(() => {
    const stored = window.localStorage.getItem("aiProvider");
    return stored === "gemini" || stored === "ollama" ? stored : "ollama";
  });

  const buildDatasetContext = () => {
    return {
      datasetSize: datasetInfo.totalImages || 0,
      numClasses: 3,
      avgImageResolution: "1280x720",
      hardware: "CPU",
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
    source: "training_config",
    contextBuilder: buildDatasetContext,
    systemPrompt: SYSTEM_PROMPT,
  });

  useEffect(() => {
    window.localStorage.setItem("aiProvider", provider);
  }, [provider]);

  const buildDatasetPrompt = () => {
    const datasetSummary = {
      totalImages: datasetInfo.totalImages || 0,
      labeledImages: datasetInfo.labeledImages || 0,
      unlabeledImages: datasetInfo.unlabeledImages || 0,
      version: datasetInfo.version || "Unknown",
      status: datasetInfo.status || "Unknown",
      modelType: modelType,
      currentParams: {
        epochs: currentParams?.epochs || 100,
        batchSize: currentParams?.batchSize || 16,
        imgSize: currentParams?.imgSize || 640,
        learningRate: currentParams?.learningRate || 0.01,
        workers: currentParams?.workers || 4
      }
    };

    return `I need help selecting optimal training hyperparameters for a ${modelType} model.

Dataset Information:
- Total Images: ${datasetSummary.totalImages}
- Labeled Images: ${datasetSummary.labeledImages}
- Unlabeled Images: ${datasetSummary.unlabeledImages}
- Dataset Version: ${datasetSummary.version}
- Dataset Status: ${datasetSummary.status}

Current Parameters (if any):
- Epochs: ${datasetSummary.currentParams.epochs}
- Batch Size: ${datasetSummary.currentParams.batchSize}
- Image Size: ${datasetSummary.currentParams.imgSize}
- Learning Rate: ${datasetSummary.currentParams.learningRate}
- Workers: ${datasetSummary.currentParams.workers}

Please suggest optimal hyperparameters and provide:
1. Recommended values for each parameter
2. Brief explanation for each recommendation
3. Expected training time estimate (if possible)
4. Any warnings or considerations
5. You are an AI assistant helping a non-technical user.
6. Answer the questions in short and simple language.

After your explanation, provide the parameters in JSON format like this:
{
  "epochs": number,
  "batchSize": number,
  "imgSize": number,
  "learningRate": number,
  "workers": number,
  "reasoning": {
    "epochs": "explanation",
    "batchSize": "explanation",
    "imgSize": "explanation",
    "learningRate": "explanation",
    "workers": "explanation"
  }
}`;
  };

  const handleAnalyze = async () => {
    if (!isAvailable) {
      return;
    }

    clearMessages();
    setSuggestedParams(null);
    const prompt = buildDatasetPrompt();
    const response = await sendMessage(prompt);
    
    // Try to extract JSON from response
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.epochs || parsed.batchSize) {
          setSuggestedParams({
            epochs: parsed.epochs,
            batchSize: parsed.batchSize,
            imgSize: parsed.imgSize,
            learningRate: parsed.learningRate,
            workers: parsed.workers
          });
        }
      }
    } catch {
      // JSON parsing failed, ignore
    }
  };

  const handleSend = async () => {
    if (!userInput.trim() || isLoading || !isAvailable) return;

    const input = userInput.trim();
    setUserInput("");
    await sendMessage(input);
  };

  const handleApplySuggestions = () => {
    if (suggestedParams && onParamsSuggested) {
      onParamsSuggested(suggestedParams);
      setIsOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
        disabled={isAvailable === false}
      >
        <Sparkles className="h-4 w-4" />
        Ask AI
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="flex flex-col sm:max-w-2xl w-full sm:w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Parameter Suggestions
            </SheetTitle>
            <SheetDescription>
              Get AI-powered hyperparameter recommendations based on your dataset
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
                  Click &quot;Analyze Dataset&quot; to get AI suggestions for optimal hyperparameters.
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
                      Analyzing dataset and generating suggestions...
                    </div>
                  </div>
                </div>
              )}

              {suggestedParams && (
                <div className="border rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Suggested Parameters:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {suggestedParams.epochs && (
                      <div>
                        <span className="text-muted-foreground">Epochs:</span>{" "}
                        <span className="font-medium">{suggestedParams.epochs}</span>
                      </div>
                    )}
                    {suggestedParams.batchSize && (
                      <div>
                        <span className="text-muted-foreground">Batch Size:</span>{" "}
                        <span className="font-medium">{suggestedParams.batchSize}</span>
                      </div>
                    )}
                    {suggestedParams.imgSize && (
                      <div>
                        <span className="text-muted-foreground">Image Size:</span>{" "}
                        <span className="font-medium">{suggestedParams.imgSize}</span>
                      </div>
                    )}
                    {suggestedParams.learningRate && (
                      <div>
                        <span className="text-muted-foreground">Learning Rate:</span>{" "}
                        <span className="font-medium">{suggestedParams.learningRate}</span>
                      </div>
                    )}
                    {suggestedParams.workers && (
                      <div>
                        <span className="text-muted-foreground">Workers:</span>{" "}
                        <span className="font-medium">{suggestedParams.workers}</span>
                      </div>
                    )}
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
                placeholder="Ask about specific parameters..."
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
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Dataset
                </Button>
              )}
              {suggestedParams && onParamsSuggested && !isLoading && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleApplySuggestions}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Apply Suggestions
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};
