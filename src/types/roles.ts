export type UserRole =
  | "platform_admin"
  | "workspace_admin"
  | "ml_engineer"
  | "operator"
  | "viewer";

export interface RolePermissions {
  // Platform Admin permissions
  manageGlobalConfig: boolean;
  removeUsers: boolean; // Platform-wide

  // Workspace Admin permissions
  manageWorkspace: boolean;
  manageProjects: boolean;
  manageWorkspaceUsers: boolean;
  assignRoles: boolean;
  deleteProjects: boolean;

  // ML Engineer permissions
  manageDatasets: boolean;
  startTraining: boolean;
  tuneHyperparameters: boolean;
  viewTrainingMetrics: boolean;

  // Operator permissions
  runInference: boolean;
  monitorInference: boolean;
  viewInferenceResults: boolean;

  // Viewer permissions
  viewProjects: boolean;
  viewDatasets: boolean;
  viewModels: boolean;
  viewInference: boolean;
}

