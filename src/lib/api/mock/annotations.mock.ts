import type { Image, Annotation } from "@/types/annotation";
import { mockImages } from "@/lib/mocks/annotationMocks";

// In-memory storage for mock annotations
const mockAnnotationsStorage: Record<string, Annotation[]> = {};
const mockImagesStorage: Record<string, Image[]> = {};

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get unlabeled images for a dataset
 * GET /api/dataset/:datasetId/unlabeled-images
 */
export const getUnlabeledImages = async (
  datasetId: string,
  params?: { page?: number; limit?: number }
): Promise<{
  images: Image[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  await delay(200 + Math.random() * 300); // 200-500ms delay

  // Initialize storage for this dataset if not exists
  if (!mockImagesStorage[datasetId]) {
    // Create mock images with dataset-specific IDs
    mockImagesStorage[datasetId] = mockImages.map((img, idx) => ({
      ...img,
      id: `${datasetId}_img_${idx + 1}`,
      filename: `image_${idx + 1}.jpg`,
    }));
  }

  const allImages = mockImagesStorage[datasetId];
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedImages = allImages.slice(startIndex, endIndex);
  const totalPages = Math.ceil(allImages.length / limit);

  return {
    images: paginatedImages,
    total: allImages.length,
    page,
    limit,
    totalPages,
  };
};

/**
 * Get annotations for a dataset (optionally filtered by imageId)
 * GET /api/dataset/:datasetId/annotations
 */
export const getAnnotations = async (
  datasetId: string,
  imageId?: string
): Promise<{
  annotations: Annotation[];
  total: number;
}> => {
  await delay(150 + Math.random() * 200); // 150-350ms delay

  const annotations = mockAnnotationsStorage[datasetId] ?? [];
  const filtered = imageId
    ? annotations.filter((a) => a.imageId === imageId)
    : annotations;

  return {
    annotations: filtered,
    total: filtered.length,
  };
};

/**
 * Save a single annotation
 * POST /api/dataset/:datasetId/annotations
 */
export const saveAnnotation = async (
  datasetId: string,
  annotation: {
    imageId: string;
    bbox: [number, number, number, number];
    categoryId: string;
  }
): Promise<{
  annotation: Annotation;
  message: string;
}> => {
  await delay(200 + Math.random() * 300); // 200-500ms delay

  // Get category name (mock - in real API this would come from backend)
  const categoryName = "Defect"; // Default for now

  const newAnnotation: Annotation = {
    id: `ann_${datasetId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    imageId: annotation.imageId,
    bbox: annotation.bbox,
    categoryId: annotation.categoryId,
    categoryName,
  };

  // Initialize storage if needed
  if (!mockAnnotationsStorage[datasetId]) {
    mockAnnotationsStorage[datasetId] = [];
  }

  mockAnnotationsStorage[datasetId].push(newAnnotation);

  return {
    annotation: newAnnotation,
    message: "Annotation saved successfully",
  };
};

/**
 * Update an existing annotation
 * PUT /api/dataset/:datasetId/annotations/:annotationId
 */
export const updateAnnotation = async (
  datasetId: string,
  annotationId: string,
  data: {
    bbox?: [number, number, number, number];
    categoryId?: string;
  }
): Promise<{
  annotation: Annotation;
  message: string;
}> => {
  await delay(200 + Math.random() * 300); // 200-500ms delay

  const annotations = mockAnnotationsStorage[datasetId] ?? [];
  const index = annotations.findIndex((a) => a.id === annotationId);

  if (index === -1) {
    throw new Error("Annotation not found");
  }

  const updated: Annotation = {
    ...annotations[index],
    ...(data.bbox && { bbox: data.bbox }),
    ...(data.categoryId && {
      categoryId: data.categoryId,
      categoryName: "Defect", // Mock - would come from backend
    }),
  };

  annotations[index] = updated;
  mockAnnotationsStorage[datasetId] = annotations;

  return {
    annotation: updated,
    message: "Annotation updated",
  };
};

/**
 * Delete an annotation
 * DELETE /api/dataset/:datasetId/annotations/:annotationId
 */
export const deleteAnnotation = async (
  datasetId: string,
  annotationId: string
): Promise<{
  message: string;
  annotationId: string;
}> => {
  await delay(150 + Math.random() * 200); // 150-350ms delay

  const annotations = mockAnnotationsStorage[datasetId] ?? [];
  const filtered = annotations.filter((a) => a.id !== annotationId);

  if (filtered.length === annotations.length) {
    throw new Error("Annotation not found");
  }

  mockAnnotationsStorage[datasetId] = filtered;

  return {
    message: "Annotation deleted",
    annotationId,
  };
};

/**
 * Batch save annotations
 * POST /api/dataset/:datasetId/annotations/batch
 */
export const batchSaveAnnotations = async (
  datasetId: string,
  annotations: Array<{
    imageId: string;
    bbox: [number, number, number, number];
    categoryId: string;
  }>
): Promise<{
  saved: number;
  failed: number;
  errors?: Array<{ imageId: string; error: string }>;
}> => {
  await delay(300 + Math.random() * 400); // 300-700ms delay

  // Initialize storage if needed
  if (!mockAnnotationsStorage[datasetId]) {
    mockAnnotationsStorage[datasetId] = [];
  }

  const errors: Array<{ imageId: string; error: string }> = [];
  let saved = 0;

  annotations.forEach((ann) => {
    try {
      const newAnnotation: Annotation = {
        id: `ann_${datasetId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        imageId: ann.imageId,
        bbox: ann.bbox,
        categoryId: ann.categoryId,
        categoryName: "Defect", // Mock
      };
      mockAnnotationsStorage[datasetId].push(newAnnotation);
      saved++;
    } catch (error) {
      errors.push({
        imageId: ann.imageId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return {
    saved,
    failed: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  };
};
