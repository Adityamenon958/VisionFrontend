import { useState, useCallback, useRef, useEffect } from "react";

interface UseAnnotationSelectionReturn {
  selectedAnnotationIds: string[];
  isSelected: (id: string) => boolean;
  selectAnnotation: (id: string, multiSelect?: boolean) => void;
  deselectAnnotation: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  toggleSelection: (id: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
}

/**
 * Hook for managing multi-select annotation state
 */
export const useAnnotationSelection = (): UseAnnotationSelectionReturn => {
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([]);

  const isSelected = useCallback(
    (id: string) => selectedAnnotationIds.includes(id),
    [selectedAnnotationIds]
  );

  const selectAnnotation = useCallback((id: string, multiSelect = false) => {
    setSelectedAnnotationIds((prev) => {
      if (multiSelect) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return [id];
    });
  }, []);

  const deselectAnnotation = useCallback((id: string) => {
    setSelectedAnnotationIds((prev) => prev.filter((selectedId) => selectedId !== id));
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedAnnotationIds(ids);
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedAnnotationIds([]);
  }, []);

  const toggleSelection = useCallback(
    (id: string, multiSelect = false) => {
      setSelectedAnnotationIds((prev) => {
        if (multiSelect) {
          return prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id];
        }
        return prev.includes(id) ? [] : [id];
      });
    },
    []
  );

  const clearSelection = useCallback(() => {
    setSelectedAnnotationIds([]);
  }, []);

  // Handle Ctrl+A to select all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "a") {
        // Prevent default browser select all
        e.preventDefault();
        // Note: selectAll will be called from component with available IDs
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    selectedAnnotationIds,
    isSelected,
    selectAnnotation,
    deselectAnnotation,
    selectAll,
    deselectAll,
    toggleSelection,
    clearSelection,
  };
};
