import type { UserRole, RolePermissions } from "@/types/roles";

/**
 * Returns the permissions associated with a given role.
 *
 * NOTE:
 * - This is frontend-only logic to drive UI visibility.
 * - The backend is still the source of truth for authorization.
 * - Keep this mapping in sync with backend rules when they are finalized.
 */
export const getRolePermissions = (role: UserRole): RolePermissions => {
  const base: RolePermissions = {
    // Platform Admin
    manageGlobalConfig: false,
    removeUsers: false,

    // Workspace Admin
    manageWorkspace: false,
    manageProjects: false,
    manageWorkspaceUsers: false,
    assignRoles: false,
    deleteProjects: false,

    // ML Engineer
    manageDatasets: false,
    startTraining: false,
    tuneHyperparameters: false,
    viewTrainingMetrics: false,

    // Operator
    runInference: false,
    monitorInference: false,
    viewInferenceResults: false,

    // Viewer
    viewProjects: false,
    viewDatasets: false,
    viewModels: false,
    viewInference: false,
  };

  switch (role) {
    case "platform_admin": {
      return {
        ...base,
        manageGlobalConfig: true,
        removeUsers: true,
        manageWorkspace: true,
        manageProjects: true,
        manageWorkspaceUsers: true,
        assignRoles: true,
        deleteProjects: true,
        manageDatasets: true,
        startTraining: true,
        tuneHyperparameters: true,
        viewTrainingMetrics: true,
        runInference: true,
        monitorInference: true,
        viewInferenceResults: true,
        viewProjects: true,
        viewDatasets: true,
        viewModels: true,
        viewInference: true,
      };
    }
    case "workspace_admin": {
      return {
        ...base,
        manageWorkspace: true,
        manageProjects: true,
        manageWorkspaceUsers: true,
        assignRoles: true,
        deleteProjects: true,
        manageDatasets: true,
        startTraining: true,
        tuneHyperparameters: true,
        viewTrainingMetrics: true,
        runInference: true,
        monitorInference: true,
        viewInferenceResults: true,
        viewProjects: true,
        viewDatasets: true,
        viewModels: true,
        viewInference: true,
      };
    }
    case "ml_engineer": {
      return {
        ...base,
        manageDatasets: true,
        startTraining: true,
        tuneHyperparameters: true,
        viewTrainingMetrics: true,
        runInference: true,
        monitorInference: true,
        viewInferenceResults: true,
        viewProjects: true,
        viewDatasets: true,
        viewModels: true,
        viewInference: true,
      };
    }
    case "operator": {
      return {
        ...base,
        runInference: true,
        monitorInference: true,
        viewInferenceResults: true,
        viewProjects: true,
        viewDatasets: true,
        viewModels: true,
        viewInference: true,
      };
    }
    case "viewer":
    default: {
      return {
        ...base,
        viewProjects: true,
        viewDatasets: true,
        viewModels: true,
        viewInference: true,
      };
    }
  }
};

export const hasPermission = (
  role: UserRole | null | undefined,
  permission: keyof RolePermissions
): boolean => {
  if (!role) return false;
  const perms = getRolePermissions(role);
  return perms[permission] === true;
};

