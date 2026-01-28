import { useEffect, useRef, useCallback } from "react";
import type { Category } from "@/types/annotation";

interface UseAnnotationShortcutsProps {
  isFocused: boolean;
  selectedCategoryId: string | null;
  selectedAnnotationId: string | null;
  categories: Category[];
  isDrawing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onDrawToggle: () => void;
  onCancelDraw: () => void;
  onDeleteAnnotation: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCategorySelect: (categoryId: string) => void;
  onPreviousImage: () => void;
  onNextImage: () => void;
}

/**
 * Hook to handle keyboard shortcuts for annotation workspace
 * Only active when workspace is focused and user is not typing
 */
export const useAnnotationShortcuts = ({
  isFocused,
  selectedCategoryId,
  selectedAnnotationId,
  categories,
  isDrawing,
  canUndo,
  canRedo,
  onDrawToggle,
  onCancelDraw,
  onDeleteAnnotation,
  onUndo,
  onRedo,
  onCategorySelect,
  onPreviousImage,
  onNextImage,
}: UseAnnotationShortcutsProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle shortcuts when workspace is focused
      if (!isFocused) return;

      // Ignore shortcuts when typing in inputs
      const activeElement = document.activeElement;
      const isTyping =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.getAttribute("contenteditable") === "true";

      if (isTyping) return;

      // D → draw mode
      if ((e.key === "d" || e.key === "D") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onDrawToggle();
        return;
      }

      // Esc → cancel draw
      if (e.key === "Escape") {
        e.preventDefault();
        onCancelDraw();
        return;
      }

      // Delete → delete selected annotation
      if (e.key === "Delete" && selectedAnnotationId) {
        e.preventDefault();
        onDeleteAnnotation(selectedAnnotationId);
        return;
      }

      // Ctrl+Z → undo
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          onUndo();
        }
        return;
      }

      // Ctrl+Shift+Z → redo
      if (e.ctrlKey && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo) {
          onRedo();
        }
        return;
      }

      // 1-9 → select category
      const categoryIndex = parseInt(e.key) - 1;
      if (
        categoryIndex >= 0 &&
        categoryIndex < categories.length &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        onCategorySelect(categories[categoryIndex].id);
        return;
      }

      // Arrow keys → image navigation
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPreviousImage();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNextImage();
        return;
      }
    },
    [
      isFocused,
      selectedCategoryId,
      selectedAnnotationId,
      categories,
      isDrawing,
      canUndo,
      canRedo,
      onDrawToggle,
      onCancelDraw,
      onDeleteAnnotation,
      onUndo,
      onRedo,
      onCategorySelect,
      onPreviousImage,
      onNextImage,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
