import React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AnnotationToolbarProps {
  onDraw?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isDrawing?: boolean;
}

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  onDraw,
  onDelete,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isDrawing,
}) => {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2" role="toolbar" aria-label="Annotation tools">
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isDrawing ? "default" : "outline"}
                size="sm"
                type="button"
                onClick={onDraw}
                aria-label={isDrawing ? "Exit drawing mode" : "Enter drawing mode"}
              >
                {isDrawing ? "Drawing..." : "Draw"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isDrawing ? "Exit drawing mode (Esc)" : "Enter drawing mode (D)"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onDelete}
                aria-label="Delete selected annotation"
              >
                Delete
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete selected annotation (Delete key)</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  aria-label={canUndo ? "Undo last action" : "Nothing to undo"}
                >
                  Undo
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{canUndo ? "Undo last action (Ctrl+Z)" : "Nothing to undo"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  aria-label={canRedo ? "Redo last action" : "Nothing to redo"}
                >
                  Redo
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{canRedo ? "Redo last action (Ctrl+Shift+Z)" : "Nothing to redo"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};


