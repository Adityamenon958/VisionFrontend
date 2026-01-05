import React, { useState, useRef, useCallback, useMemo } from "react";
import type { Annotation, Category } from "@/types/annotation";
import { normalizeBbox, calculateBbox, validateBbox, denormalizeBbox, getResizeHandle } from "@/lib/utils/bboxUtils";

interface BoundingBoxCanvasProps {
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
  categories?: Category[];
  selectedCategoryId: string | null;
  isDrawing: boolean;
  selectedAnnotationId: string | null;
  selectedAnnotationIds?: string[]; // Phase 6: Multi-select
  onBboxDraw?: (bbox: [number, number, number, number]) => void;
  onAnnotationClick?: (annotationId: string, multiSelect?: boolean) => void;
  onAnnotationUpdate?: (annotationId: string, bbox: [number, number, number, number]) => void; // Phase 6: Move/resize
}

interface DrawingState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// Phase 3: Full drawing functionality
// Phase 6: Enhanced with move/resize and multi-select
export const BoundingBoxCanvas: React.FC<BoundingBoxCanvasProps> = ({
  imageWidth,
  imageHeight,
  annotations,
  categories = [],
  selectedCategoryId,
  isDrawing,
  selectedAnnotationId,
  selectedAnnotationIds = [],
  onBboxDraw,
  onAnnotationClick,
  onAnnotationUpdate,
}) => {
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [editingState, setEditingState] = useState<{
    annotationId: string;
    mode: "move" | "resize";
    handle?: "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";
    startX: number;
    startY: number;
    startBbox: [number, number, number, number];
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Get category color by ID
  const getCategoryColor = (categoryId: string): string => {
    const category = categories.find((cat) => cat.id === categoryId);
    return category?.color ?? "#ef4444"; // Default red if not found
  };

  // RAF throttling for mousemove
  const rafRef = useRef<number>();
  const pendingUpdate = useRef<{ x: number; y: number } | null>(null);

  // Get mouse position relative to canvas
  const getMousePosition = (e: React.MouseEvent<HTMLDivElement>): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Handle mouse down - start drawing or editing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDrawing && selectedCategoryId) {
        // Drawing mode
        const { x, y } = getMousePosition(e);
        setDrawingState({
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
        });
        return;
      }

      // Check if clicking on annotation or resize handle
      const target = e.target as HTMLElement;
      const annotationElement = target.closest('[data-annotation-id]');
      
      if (annotationElement) {
        const annotationId = annotationElement.getAttribute('data-annotation-id');
        if (!annotationId) return;

        const annotation = annotations.find((a) => a.id === annotationId);
        if (!annotation) return;

        const { x, y } = getMousePosition(e);
        const [nx, ny, nw, nh] = annotation.bbox;
        const pixelBbox = {
          left: nx * imageWidth,
          top: ny * imageHeight,
          width: nw * imageWidth,
          height: nh * imageHeight,
        };

        // Check if clicking on resize handle
        const handle = getResizeHandle({ x, y }, pixelBbox);
        
        if (handle && selectedAnnotationId === annotationId && onAnnotationUpdate) {
          // Start resizing
          setEditingState({
            annotationId,
            mode: "resize",
            handle,
            startX: x,
            startY: y,
            startBbox: annotation.bbox,
          });
          e.preventDefault();
          e.stopPropagation();
        } else if (selectedAnnotationId === annotationId && onAnnotationUpdate) {
          // Start moving
          setEditingState({
            annotationId,
            mode: "move",
            startX: x,
            startY: y,
            startBbox: annotation.bbox,
          });
          e.preventDefault();
          e.stopPropagation();
        } else if (onAnnotationClick) {
          // Select annotation
          onAnnotationClick(annotationId, e.shiftKey);
        }
      }
    },
    [isDrawing, selectedCategoryId, selectedAnnotationId, annotations, imageWidth, imageHeight, onAnnotationClick, onAnnotationUpdate]
  );

  // Handle mouse move - update active box or editing (throttled with RAF)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { x, y } = getMousePosition(e);

      // Handle drawing
      if (drawingState && isDrawing) {
        pendingUpdate.current = { x, y };

        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            if (pendingUpdate.current) {
              setDrawingState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  currentX: pendingUpdate.current!.x,
                  currentY: pendingUpdate.current!.y,
                };
              });
              pendingUpdate.current = null;
            }
            rafRef.current = undefined;
          });
        }
        return;
      }

      // Handle editing (move/resize)
      if (editingState && onAnnotationUpdate) {
        pendingUpdate.current = { x, y };

        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            if (pendingUpdate.current && editingState) {
              const { annotationId, mode, handle, startX, startY, startBbox } = editingState;
              const dx = pendingUpdate.current.x - startX;
              const dy = pendingUpdate.current.y - startY;

              let newBbox: [number, number, number, number];

              if (mode === "move") {
                // Move: translate bbox
                const [sx, sy, sw, sh] = startBbox;
                const ndx = dx / imageWidth;
                const ndy = dy / imageHeight;
                newBbox = [
                  Math.max(0, Math.min(1, sx + ndx)),
                  Math.max(0, Math.min(1, sy + ndy)),
                  sw,
                  sh,
                ];
              } else {
                // Resize: adjust based on handle
                const pixelBbox = denormalizeBbox(startBbox, imageWidth, imageHeight);
                let newPixelBbox = { ...pixelBbox };

                if (handle?.includes("w")) {
                  newPixelBbox.left = Math.max(0, pixelBbox.left + dx);
                  newPixelBbox.width = pixelBbox.width - dx;
                }
                if (handle?.includes("e")) {
                  newPixelBbox.width = Math.max(10, pixelBbox.width + dx);
                }
                if (handle?.includes("n")) {
                  newPixelBbox.top = Math.max(0, pixelBbox.top + dy);
                  newPixelBbox.height = pixelBbox.height - dy;
                }
                if (handle?.includes("s")) {
                  newPixelBbox.height = Math.max(10, pixelBbox.height + dy);
                }

                // Ensure minimum size
                if (newPixelBbox.width < 10) {
                  newPixelBbox.width = 10;
                  if (handle?.includes("w")) {
                    newPixelBbox.left = pixelBbox.left + pixelBbox.width - 10;
                  }
                }
                if (newPixelBbox.height < 10) {
                  newPixelBbox.height = 10;
                  if (handle?.includes("n")) {
                    newPixelBbox.top = pixelBbox.top + pixelBbox.height - 10;
                  }
                }

                // Clamp to image bounds
                newPixelBbox.left = Math.max(0, Math.min(imageWidth - newPixelBbox.width, newPixelBbox.left));
                newPixelBbox.top = Math.max(0, Math.min(imageHeight - newPixelBbox.height, newPixelBbox.top));
                newPixelBbox.width = Math.min(imageWidth - newPixelBbox.left, newPixelBbox.width);
                newPixelBbox.height = Math.min(imageHeight - newPixelBbox.top, newPixelBbox.height);

                newBbox = normalizeBbox(newPixelBbox, imageWidth, imageHeight);
              }

              onAnnotationUpdate(annotationId, newBbox);
              pendingUpdate.current = null;
            }
            rafRef.current = undefined;
          });
        }
      }
    },
    [drawingState, isDrawing, editingState, imageWidth, imageHeight, onAnnotationUpdate]
  );

  // Handle mouse up - finalize box or editing
  const handleMouseUp = useCallback(() => {
    // Finalize drawing
    if (drawingState && isDrawing && selectedCategoryId) {
      const { startX, startY, currentX, currentY } = drawingState;

      // Calculate box coordinates using utility
      const bbox = calculateBbox(startX, startY, currentX, currentY);

      // Validate minimum size (10x10 pixels)
      const MIN_SIZE = 10;
      if (!validateBbox(bbox, MIN_SIZE)) {
        setDrawingState(null);
        return;
      }

      // Normalize coordinates using utility
      const normalizedBbox = normalizeBbox(bbox, imageWidth, imageHeight);

      // Call callback to create annotation
      if (onBboxDraw) {
        onBboxDraw(normalizedBbox);
      }

      setDrawingState(null);
      return;
    }

    // Finalize editing
    if (editingState) {
      setEditingState(null);
    }
  }, [drawingState, isDrawing, selectedCategoryId, editingState, imageWidth, imageHeight, onBboxDraw]);

  // Calculate active box (while drawing) - memoized
  const activeBox = useMemo(() => {
    if (!drawingState) return null;
    const { startX, startY, currentX, currentY } = drawingState;
    return calculateBbox(startX, startY, currentX, currentY);
  }, [drawingState]);

  const activeCategoryColor = useMemo(
    () => (selectedCategoryId ? getCategoryColor(selectedCategoryId) : "#ef4444"),
    [selectedCategoryId, categories]
  );

  // Memoized bounding box component with resize handles
  const MemoizedBoundingBox = React.memo<{
    annotation: Annotation;
    imageWidth: number;
    imageHeight: number;
    categoryColor: string;
    isSelected: boolean;
    onAnnotationClick?: (id: string, multiSelect?: boolean) => void;
  }>(
    ({ annotation, imageWidth, imageHeight, categoryColor, isSelected, onAnnotationClick }) => {
      const [x, y, width, height] = annotation.bbox;
      const left = x * imageWidth;
      const top = y * imageHeight;
      const boxWidth = width * imageWidth;
      const boxHeight = height * imageHeight;

      // Resize handles (corners and edges)
      const handles = isSelected
        ? [
            { pos: "nw", style: { left: "-4px", top: "-4px", cursor: "nw-resize" } },
            { pos: "ne", style: { right: "-4px", top: "-4px", cursor: "ne-resize" } },
            { pos: "sw", style: { left: "-4px", bottom: "-4px", cursor: "sw-resize" } },
            { pos: "se", style: { right: "-4px", bottom: "-4px", cursor: "se-resize" } },
            { pos: "n", style: { left: "50%", top: "-4px", transform: "translateX(-50%)", cursor: "n-resize" } },
            { pos: "s", style: { left: "50%", bottom: "-4px", transform: "translateX(-50%)", cursor: "s-resize" } },
            { pos: "w", style: { left: "-4px", top: "50%", transform: "translateY(-50%)", cursor: "w-resize" } },
            { pos: "e", style: { right: "-4px", top: "50%", transform: "translateY(-50%)", cursor: "e-resize" } },
          ]
        : [];

      return (
        <div
          data-annotation-id={annotation.id}
          className={`absolute border-2 transition-all ${
            isSelected
              ? "ring-2 ring-blue-500 shadow-lg z-10 cursor-move"
              : "hover:ring-1 hover:ring-blue-300 hover:shadow-md z-0"
          } ${onAnnotationClick ? "cursor-pointer" : "pointer-events-none"}`}
          style={{
            left: `${left}px`,
            top: `${top}px`,
            width: `${boxWidth}px`,
            height: `${boxHeight}px`,
            borderColor: categoryColor,
            borderWidth: isSelected ? "3px" : "2px",
          }}
          onClick={(e) => {
            if (onAnnotationClick) {
              e.stopPropagation();
              onAnnotationClick(annotation.id, e.shiftKey);
            }
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.borderWidth = "2.5px";
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.borderWidth = "2px";
            }
          }}
        >
          {/* Resize handles */}
          {handles.map((handle) => (
            <div
              key={handle.pos}
              className="absolute w-2 h-2 bg-blue-500 border border-blue-700 rounded-sm z-20"
              style={handle.style}
              data-resize-handle={handle.pos}
            />
          ))}

          {/* Category label */}
          <div
            className="absolute -top-5 left-0 px-1 text-[10px] text-white rounded"
            style={{ backgroundColor: categoryColor }}
          >
            {annotation.categoryName}
          </div>

          {/* State badge (Phase 6) */}
          {annotation.state && annotation.state !== "draft" && (
            <div
              className={`absolute -bottom-5 left-0 px-1 text-[9px] rounded ${
                annotation.state === "approved"
                  ? "bg-green-500 text-white"
                  : annotation.state === "reviewed"
                  ? "bg-blue-500 text-white"
                  : "bg-red-500 text-white"
              }`}
            >
              {annotation.state.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      );
    },
    (prev, next) => {
      return (
        prev.annotation.id === next.annotation.id &&
        prev.isSelected === next.isSelected &&
        prev.categoryColor === next.categoryColor &&
        prev.annotation.bbox[0] === next.annotation.bbox[0] &&
        prev.annotation.bbox[1] === next.annotation.bbox[1] &&
        prev.annotation.bbox[2] === next.annotation.bbox[2] &&
        prev.annotation.bbox[3] === next.annotation.bbox[3]
      );
    }
  );

  // Memoize rendered bounding boxes
  const renderedBoxes = useMemo(() => {
    return annotations.map((annotation) => {
      const categoryColor = getCategoryColor(annotation.categoryId);
      const isSelected = annotation.id === selectedAnnotationId || selectedAnnotationIds.includes(annotation.id);
      return (
        <MemoizedBoundingBox
          key={annotation.id}
          annotation={annotation}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          categoryColor={categoryColor}
          isSelected={isSelected}
          onAnnotationClick={onAnnotationClick}
        />
      );
    });
  }, [annotations, imageWidth, imageHeight, selectedAnnotationId, selectedAnnotationIds, categories, onAnnotationClick]);

  // Cleanup RAF on unmount
  React.useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={canvasRef}
      className={`absolute inset-0 ${isDrawing ? "cursor-crosshair" : "cursor-default"}`}
      aria-label={`Bounding box canvas with ${annotations.length} annotations`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        if (editingState) {
          setEditingState(null);
        }
      }}
    >
      {/* Render saved annotations */}
      {renderedBoxes}

      {/* Render active box (while drawing) */}
      {activeBox && (
        <div
          className="absolute border-2 border-dashed opacity-70 pointer-events-none"
          style={{
            left: `${activeBox.left}px`,
            top: `${activeBox.top}px`,
            width: `${activeBox.width}px`,
            height: `${activeBox.height}px`,
            borderColor: activeCategoryColor,
          }}
        />
      )}
    </div>
  );
};


