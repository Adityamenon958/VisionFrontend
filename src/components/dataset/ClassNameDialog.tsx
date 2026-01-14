import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type {
  DetectedClassesResponse,
  CreateCategoriesFromClassesResponse,
} from "@/lib/api/categories";
import { createCategoriesFromClasses } from "@/lib/api/categories";

interface ClassNameDialogProps {
  datasetId: string;
  detectedClasses: DetectedClassesResponse;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClassNameDialog: React.FC<ClassNameDialogProps> = ({
  datasetId,
  detectedClasses,
  open,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [classMappings, setClassMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with empty values when dialog opens
  useEffect(() => {
    if (open && detectedClasses) {
      const initial: Record<string, string> = {};
      detectedClasses.classIds.forEach((id) => {
        initial[id.toString()] = "";
      });
      setClassMappings(initial);
      setShowForm(false);
      setErrors({});
    }
  }, [open, detectedClasses]);

  const handleNameChange = (classId: number, value: string) => {
    const trimmedValue = value.trim();
    
    // Validation: max 50 characters
    if (trimmedValue.length > 50) {
      setErrors((prev) => ({
        ...prev,
        [classId.toString()]: "Maximum 50 characters allowed",
      }));
      return;
    }

    // Clear error for this field
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[classId.toString()];
      return newErrors;
    });

    setClassMappings((prev) => ({
      ...prev,
      [classId.toString()]: trimmedValue,
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrors({});

    try {
      // Trim all values before submission
      const trimmedMappings: Record<string, string> = {};
      Object.keys(classMappings).forEach((key) => {
        trimmedMappings[key] = classMappings[key].trim();
      });

      const response: CreateCategoriesFromClassesResponse =
        await createCategoriesFromClasses(datasetId, trimmedMappings);

      toast({
        title: "Success",
        description: "Class names saved! Dataset ready for training.",
        variant: "default",
      });

      // Auto-close after 2 seconds
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error("Error submitting class names:", error);
      
      let errorMessage = "Failed to save class names";
      
      // Handle specific error cases
      if (error.message) {
        if (error.message.includes("Categories already exist")) {
          errorMessage = "Categories already exist for this dataset";
          // Close dialog on this error (categories already exist)
          setTimeout(() => {
            onClose();
          }, 2000);
        } else if (error.message.includes("Invalid class ID")) {
          errorMessage = error.message;
          // Extract invalid class IDs from error message if possible
          const invalidMatch = error.message.match(/Invalid class ID: (\d+)/);
          if (invalidMatch) {
            const invalidId = invalidMatch[1];
            setErrors((prev) => ({
              ...prev,
              [invalidId]: "Invalid class ID",
            }));
          }
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleYes = () => {
    setShowForm(true);
  };

  const handleNo = () => {
    onClose();
  };

  if (!open || !detectedClasses) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !loading && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        {!showForm ? (
          // Initial popup: Ask if user wants to add names
          <>
            <DialogHeader>
              <DialogTitle>Add Class Names</DialogTitle>
              <DialogDescription>
                Detected <strong>{detectedClasses.totalClasses}</strong> class{" "}
                {detectedClasses.totalClasses === 1 ? "ID" : "IDs"} in your dataset.
                Do you want to give them meaningful names?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleNo}
                disabled={loading}
              >
                No, keep as-is
              </Button>
              <Button onClick={handleYes} disabled={loading}>
                Yes, add names
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Form: Input fields for each class ID
          <>
            <DialogHeader>
              <DialogTitle>Add Class Names</DialogTitle>
              <DialogDescription>
                Enter meaningful names for each class. All fields are optional.
                Empty fields will use default names (class_0, class_1, etc.).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
              {detectedClasses.classIds.map((classId) => {
                const classIdStr = classId.toString();
                const defaultValue = detectedClasses.classNames[classId] || `class_${classId}`;
                const error = errors[classIdStr];
                const value = classMappings[classIdStr] || "";

                return (
                  <div key={classId} className="space-y-2">
                    <Label htmlFor={`class-${classId}`}>
                      Class ID {classId}:
                    </Label>
                    <Input
                      id={`class-${classId}`}
                      value={value}
                      onChange={(e) => handleNameChange(classId, e.target.value)}
                      placeholder={`e.g., ${defaultValue}`}
                      maxLength={50}
                      disabled={loading}
                      className={error ? "border-destructive" : ""}
                    />
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    {!error && value.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {value.length}/50 characters
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Names"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
