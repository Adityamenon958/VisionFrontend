/**
 * Bounding box utility functions
 * Handles coordinate normalization and validation
 */

/**
 * Normalize pixel coordinate to 0-1 range
 */
export const normalizeCoords = (pixel: number, dimension: number): number => {
  return Math.max(0, Math.min(1, pixel / dimension));
};

/**
 * Denormalize 0-1 coordinate to pixel value
 */
export const denormalizeCoords = (normalized: number, dimension: number): number => {
  return normalized * dimension;
};

/**
 * Calculate bounding box from start and end coordinates
 */
export const calculateBbox = (
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { left: number; top: number; width: number; height: number } => {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
};

/**
 * Validate bounding box meets minimum size requirements
 */
export const validateBbox = (
  bbox: { width: number; height: number },
  minSize: number = 10
): boolean => {
  return bbox.width >= minSize && bbox.height >= minSize;
};

/**
 * Normalize bounding box coordinates to 0-1 range
 */
export const normalizeBbox = (
  bbox: { left: number; top: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): [number, number, number, number] => {
  return [
    normalizeCoords(bbox.left, imageWidth),
    normalizeCoords(bbox.top, imageHeight),
    normalizeCoords(bbox.width, imageWidth),
    normalizeCoords(bbox.height, imageHeight),
  ];
};

/**
 * Convert normalized bbox to pixel coordinates
 */
export const denormalizeBbox = (
  bbox: [number, number, number, number],
  imageWidth: number,
  imageHeight: number
): { left: number; top: number; width: number; height: number } => {
  return {
    left: denormalizeCoords(bbox[0], imageWidth),
    top: denormalizeCoords(bbox[1], imageHeight),
    width: denormalizeCoords(bbox[2], imageWidth),
    height: denormalizeCoords(bbox[3], imageHeight),
  };
};

/**
 * Check if point is near edge/corner of bbox (for resize handles)
 */
export const getResizeHandle = (
  point: { x: number; y: number },
  bbox: { left: number; top: number; width: number; height: number },
  handleSize: number = 8
): "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null => {
  const { left, top, width, height } = bbox;
  const right = left + width;
  const bottom = top + height;

  const isNear = (px: number, py: number, x: number, y: number) => {
    return Math.abs(px - x) < handleSize && Math.abs(py - y) < handleSize;
  };

  // Corners
  if (isNear(point.x, point.y, left, top)) return "nw";
  if (isNear(point.x, point.y, right, top)) return "ne";
  if (isNear(point.x, point.y, left, bottom)) return "sw";
  if (isNear(point.x, point.y, right, bottom)) return "se";

  // Edges
  if (Math.abs(point.x - left) < handleSize && point.y >= top && point.y <= bottom) return "w";
  if (Math.abs(point.x - right) < handleSize && point.y >= top && point.y <= bottom) return "e";
  if (Math.abs(point.y - top) < handleSize && point.x >= left && point.x <= right) return "n";
  if (Math.abs(point.y - bottom) < handleSize && point.x >= left && point.x <= right) return "s";

  return null;
};

