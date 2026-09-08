import { apiRequest, apiUrl, getAuthHeaders } from "./config";

export type MobileInspectConfig = {
  company: string;
  project: string;
  modelId: string | null;
  mongoModelId: string | null;
  modelVersion: string | null;
  modelType: string | null;
  confidenceThreshold: number;
  updatedBy: string | null;
  updatedAt: string;
};

export type InferenceModelOption = {
  modelId: string;
  _id?: string;
  id?: string;
  modelVersion?: string;
  modelType?: string;
  name?: string;
  metrics?: {
    mAP50?: number;
    precision?: number;
    recall?: number;
  };
};

export async function getMobileInspectConfig(
  company: string,
  project: string
): Promise<{ config: MobileInspectConfig | null; message?: string }> {
  const qs = new URLSearchParams({ company, project });
  return apiRequest(`/mobile-inspect/config?${qs.toString()}`);
}

export async function putMobileInspectConfig(body: {
  company: string;
  project: string;
  modelId: string;
  confidenceThreshold?: number;
}): Promise<{ config: MobileInspectConfig; message?: string }> {
  return apiRequest(`/mobile-inspect/config`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export type CorrosionByClass = {
  class: string;
  classId?: number;
  meanPercent?: number;
  percent?: number;
  count: number;
};

export type SurveyVisit = {
  inferenceId: string;
  status: string;
  regionName: string;
  surveyName: string;
  createdAt: string;
  completedAt?: string | null;
  imageCount: number;
  meanCorrosionPercent: number | null;
  byClass: CorrosionByClass[];
};

export type SurveyPart = {
  regionName: string;
  visitCount: number;
  meanCorrosionPercent: number | null;
  imageCount: number;
  byClass: CorrosionByClass[];
  severityBand: "low" | "medium" | "high" | "critical" | null;
  changeFromPrevious: { delta: number; previousMeanCorrosionPercent: number } | null;
  latest: SurveyVisit;
  latestCompleted: SurveyVisit | null;
  visits: SurveyVisit[];
};

export type SurveyDetail = {
  surveyName: string;
  partCount: number;
  completedPartCount: number;
  visitCount: number;
  overallMeanCorrosionPercent: number | null;
  byClass: CorrosionByClass[];
  classNames?: string[];
  updatedAt: string | null;
  parts: SurveyPart[];
};

export type SurveySummary = {
  surveyName: string;
  partCount: number;
  completedPartCount: number;
  visitCount: number;
  overallMeanCorrosionPercent: number | null;
  updatedAt: string | null;
};

/**
 * GET /api/mobile-inspect/surveys
 */
export async function listMobileInspectSurveys(
  company: string,
  project: string
): Promise<{ surveys: SurveySummary[] }> {
  const qs = new URLSearchParams({ company, project });
  return apiRequest(`/mobile-inspect/surveys?${qs.toString()}`);
}

/**
 * GET /api/mobile-inspect/survey
 */
export async function getMobileInspectSurvey(
  company: string,
  project: string,
  surveyName: string
): Promise<{ survey: SurveyDetail }> {
  const qs = new URLSearchParams({ company, project, surveyName });
  return apiRequest(`/mobile-inspect/survey?${qs.toString()}`);
}

/**
 * Downloads the PDF report for a survey (location, photos, change,
 * severity, approved action per area — GET /api/mobile-inspect/survey/pdf)
 * and triggers a browser save.
 */
export async function downloadSurveyPdf(
  company: string,
  project: string,
  surveyName: string
): Promise<void> {
  const qs = new URLSearchParams({ company, project, surveyName });
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/mobile-inspect/survey/pdf?${qs.toString()}`), { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text);
      message = json.message || json.error || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${surveyName.replace(/[^a-z0-9]+/gi, "_")}_report.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function listInferenceModels(
  company: string,
  project: string
): Promise<InferenceModelOption[]> {
  const qs = new URLSearchParams({ company, project });
  const json = await apiRequest<unknown>(`/inference/models?${qs.toString()}`);
  const rawList: unknown[] = Array.isArray(json)
    ? json
    : (json as { models?: unknown[]; data?: { models?: unknown[] } }).models ||
      (json as { data?: { models?: unknown[] } }).data?.models ||
      [];
  return rawList.map((raw) => {
    const r = raw as InferenceModelOption;
    return {
      ...r,
      modelId: String(r.modelId ?? r.id ?? r._id ?? ""),
    };
  });
}
