import { apiRequest } from "./config";

/**
 * Convert annotations to YOLO label format
 * POST /api/dataset/:datasetId/convert-annotations-to-labels
 */
export const convertAnnotationsToLabels = async (
  datasetId: string,
  options?: {
    imageIds?: string[];
    folder?: string;
  }
): Promise<{
  converted: number;
  labelFilesCreated: number;
  message: string;
}> => {
  const path = `/dataset/${encodeURIComponent(datasetId)}/convert-annotations-to-labels`;

  return apiRequest(path, {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
};

/**
 * Get model download URL
 * GET /api/models/:modelId/download-url
 */
export const getModelDownloadUrl = async (
  modelId: string,
  format: "pt" | "onnx" | "zip"
): Promise<{
  downloadUrl: string;
  expiresAt: string;
  fileSize: number;
}> => {
  const path = `/models/${encodeURIComponent(modelId)}/download-url?format=${format}`;

  return apiRequest(path);
};

/**
 * Get model info
 * GET /api/models/:modelId
 */
export const getModelInfo = async (
  modelId: string
): Promise<{
  id: string;
  name: string;
  format: string;
  size: number;
  createdAt: string;
  availableFormats: string[];
}> => {
  const path = `/models/${encodeURIComponent(modelId)}`;

  return apiRequest(path);
};
