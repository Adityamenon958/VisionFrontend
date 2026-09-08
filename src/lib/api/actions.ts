import { apiRequest } from "./config";

export type ActionSeverity = "low" | "medium" | "high" | "critical";
export type ActionStatus = "open" | "in_review" | "approved" | "rejected" | "completed";

export type ActionItem = {
  actionId: string;
  company: string;
  project: string;
  surveyName: string | null;
  regionName: string | null;
  inferenceId: string | null;
  filename: string | null;
  title: string;
  description: string;
  severity: ActionSeverity;
  status: ActionStatus;
  dueDate: string | null;
  createdBy: string;
  assignedTo: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListActionsParams = {
  company: string;
  project: string;
  status?: ActionStatus;
  severity?: ActionSeverity;
  overdueOnly?: boolean;
  regionName?: string;
  surveyName?: string;
  page?: number;
  limit?: number;
};

/**
 * GET /api/actions
 */
export async function listActionItems(
  params: ListActionsParams
): Promise<{ actions: ActionItem[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  return apiRequest(`/actions?${qs.toString()}`);
}

/**
 * POST /api/actions
 */
export async function createActionItem(body: {
  company: string;
  project: string;
  surveyName?: string | null;
  regionName?: string | null;
  inferenceId?: string | null;
  filename?: string | null;
  title: string;
  description?: string;
  severity: ActionSeverity;
  dueDate?: string | null;
  assignedTo?: string | null;
  findingSnapshot?: unknown;
}): Promise<{ action: ActionItem }> {
  return apiRequest(`/actions`, { method: "POST", body: JSON.stringify(body) });
}

/**
 * PATCH /api/actions/:actionId
 */
export async function updateActionItem(
  actionId: string,
  body: Partial<{
    title: string;
    description: string;
    severity: ActionSeverity;
    dueDate: string | null;
    assignedTo: string | null;
    status: ActionStatus;
  }>
): Promise<{ action: ActionItem }> {
  return apiRequest(`/actions/${encodeURIComponent(actionId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * DELETE /api/actions/:actionId
 */
export async function deleteActionItem(actionId: string): Promise<{ actionId: string; message: string }> {
  return apiRequest(`/actions/${encodeURIComponent(actionId)}`, { method: "DELETE" });
}
