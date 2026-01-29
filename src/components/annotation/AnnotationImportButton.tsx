import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api/config";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface AnnotationImportButtonProps {
  datasetId: string;
  onImportComplete?: (result: { imported: number; failed: number }) => void;
}

type ImportFormat = "yolo" | "coco" | "json" | "auto";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  preview?: {
    total: number;
    categories: string[];
    images: number;
  };
}

export const AnnotationImportButton: React.FC<AnnotationImportButtonProps> = ({
  datasetId,
  onImportComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFormat>("auto");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setValidation(null);

    // Auto-detect format
    if (format === "auto") {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".json")) {
        // Try to detect COCO vs custom JSON
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          if (json.images && json.annotations && json.categories) {
            setFormat("coco");
          } else {
            setFormat("json");
          }
        } catch {
          setFormat("json");
        }
      } else if (fileName.endsWith(".txt")) {
        setFormat("yolo");
      }
    }

    // Validate file
    try {
      await validateFile(file, format === "auto" ? "json" : format);
    } catch (error) {
      setValidation({
        valid: false,
        errors: [error instanceof Error ? error.message : "Validation failed"],
      });
    }
  };

  const validateFile = async (file: File, detectedFormat: string): Promise<void> => {
    // Basic validation - backend will do full validation
    if (file.size === 0) {
      throw new Error("File is empty");
    }

    if (detectedFormat === "json" || detectedFormat === "coco") {
      const text = await file.text();
      try {
        JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON format");
      }
    }

    setValidation({
      valid: true,
      errors: [],
      preview: {
        total: 0, // Would be calculated by backend
        categories: [],
        images: 0,
      },
    });
  };

  const handleImport = async () => {
    if (!selectedFile || !validation?.valid) return;

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("format", format === "auto" ? "json" : format);

      const path = `/dataset/${encodeURIComponent(datasetId)}/import-annotations`;
      
      const result = await apiRequest<{
        imported: number;
        failed: number;
        errors?: Array<{ line: number; error: string }>;
      }>(path, {
        method: "POST",
        body: formData,
        headers: {}, // Let browser set Content-Type for FormData
      });

      toast({
        title: "Import complete",
        description: `${result.imported} annotations imported${result.failed > 0 ? `, ${result.failed} failed` : ""}`,
        variant: result.failed > 0 ? "destructive" : "default",
      });

      onImportComplete?.(result);
      setIsOpen(false);
      setSelectedFile(null);
      setValidation(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import annotations",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Import
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Annotations</DialogTitle>
            <DialogDescription>
              Upload annotation file in YOLO, COCO, or JSON format
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Annotation File</Label>
              <Input
                id="import-file"
                type="file"
                ref={fileInputRef}
                accept=".txt,.json"
                onChange={handleFileSelect}
                disabled={importing}
              />
            </div>

            {selectedFile && (
              <div className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}

            {validation && (
              <div
                className={`p-3 rounded-md border ${
                  validation.valid
                    ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {validation.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                  <span className="font-medium text-sm">
                    {validation.valid ? "File is valid" : "Validation errors"}
                  </span>
                </div>
                {validation.errors.length > 0 && (
                  <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                    {validation.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!selectedFile || !validation?.valid || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
