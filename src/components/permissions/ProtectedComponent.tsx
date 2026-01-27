import React from "react";
import { useProfile } from "@/hooks/useProfile";
import type { UserRole, RolePermissions } from "@/types/roles";

interface ProtectedComponentProps {
  requiredPermission?: keyof RolePermissions;
  requiredRole?: UserRole;
  /**
   * Optional fallback content to render when the user does not have access.
   * If not provided, nothing will be rendered.
   */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Simple wrapper to gate UI rendering based on the current user's role/permissions.
 *
 * IMPORTANT:
 * - This only affects the frontend UI.
 * - The backend MUST still enforce authorization for all sensitive operations.
 */
export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  requiredPermission,
  requiredRole,
  fallback = null,
  children,
}) => {
  const { userRole, hasPermission } = useProfile();

  // No user / no role yet -> treat as no access
  if (!userRole) {
    return <>{fallback}</>;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <>{fallback}</>;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

