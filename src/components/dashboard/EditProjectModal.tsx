import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFormValidation } from "@/hooks/useFormValidation";
import { projectSchema } from "@/lib/validations/authSchemas";
import { useToast } from "@/hooks/use-toast";
import { renameProjectCascade } from "@/lib/api/projects";

export interface EditProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; name: string; description?: string | null } | null;
  /** Needed to cascade-rename the project's linked data in MongoDB when the name changes. */
  companyName: string;
  onSaved?: () => void;
}

export function EditProjectModal({
  open,
  onOpenChange,
  project,
  companyName,
  onSaved,
}: EditProjectModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const form = useFormValidation({
    schema: projectSchema,
    initialValues: {
      projectName: "",
      projectDescription: "",
    },
    validateOnChange: false,
    validateOnBlur: true,
  });

  // Reset form when modal opens with project data
  useEffect(() => {
    if (open && project) {
      form.setValue("projectName", project.name);
      form.setValue("projectDescription", project.description ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id, project?.name, project?.description]);

  const handleSave = async () => {
    if (!project?.id || !form.validateForm()) {
      if (!form.validateForm()) {
        toast({
          title: "Please check your details",
          description: "Fix the highlighted errors before saving.",
          variant: "destructive",
        });
      }
      return;
    }

    setSaving(true);
    try {
      const trimmedName = form.values.projectName.trim();
      const nameChanged = trimmedName !== project.name;

      const { error } = await supabase
        .from("projects")
        .update({
          name: trimmedName,
          description: (form.values.projectDescription || "").trim() || null,
        })
        .eq("id", project.id);

      if (error) throw error;

      // The project's actual inspection data (surveys, photos, actions,
      // trained models) lives in MongoDB, matched by name — keep it linked.
      if (nameChanged && companyName) {
        try {
          await renameProjectCascade(companyName, project.name, trimmedName);
        } catch (cascadeErr: any) {
          toast({
            title: "Project renamed, but linked data may be out of sync",
            description:
              cascadeErr?.message ||
              "Could not update historical inspection data under the new name. Contact support to reconcile.",
            variant: "destructive",
          });
          onOpenChange(false);
          await Promise.resolve(onSaved?.());
          return;
        }
      }

      toast({
        title: "Project updated",
        description: "Project details have been saved successfully.",
      });
      onOpenChange(false);
      await Promise.resolve(onSaved?.());
    } catch (err: any) {
      console.error("Error updating project:", err);
      toast({
        title: "Update failed",
        description: err.message ?? "Failed to update project.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update the project name and description.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="edit-project-name">Project name</Label>
            <Input
              id="edit-project-name"
              value={form.values.projectName}
              onChange={(e) => form.setValue("projectName", e.target.value)}
              onBlur={(e) => form.handleBlur("projectName")(e as React.FocusEvent<HTMLInputElement>)}
              placeholder="Enter project name"
              className="mt-1"
            />
            {form.isFieldTouched("projectName") && form.getFieldError("projectName") && (
              <p className="mt-1 text-xs text-destructive">{form.getFieldError("projectName")}</p>
            )}
          </div>
          <div>
            <Label htmlFor="edit-project-description">Description (optional)</Label>
            <Textarea
              id="edit-project-description"
              value={form.values.projectDescription ?? ""}
              onChange={(e) => form.setValue("projectDescription", e.target.value)}
              placeholder="Enter project description"
              className="mt-1"
              rows={3}
            />
            {form.isFieldTouched("projectDescription") && form.getFieldError("projectDescription") && (
              <p className="mt-1 text-xs text-destructive">{form.getFieldError("projectDescription")}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
