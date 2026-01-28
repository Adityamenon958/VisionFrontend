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

  // Dataset Management (granular permissions)
  uploadDatasets: boolean;        // Upload and manage datasets
  deleteDatasets: boolean;         // Delete datasets
  viewRawDatasetImages: boolean;  // View raw images in datasets (configurable for Viewer)
  annotateDatasets: boolean;       // Annotate datasets (create/edit annotations)

  // ML Engineer permissions
  startTraining: boolean;
  tuneHyperparameters: boolean;
  viewTrainingMetrics: boolean;

  // Operator permissions
  runInference: boolean;
  monitorInference: boolean;
  viewInferenceResults: boolean;
  deleteOwnInference: boolean; // Delete only inference jobs created by the user

  // Viewer permissions
  viewProjects: boolean;
  viewDatasets: boolean;
  viewModels: boolean;
  viewInference: boolean;
}

