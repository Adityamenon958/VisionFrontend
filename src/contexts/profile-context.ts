// src/contexts/profile-context.ts
import { createContext } from "react";

export type ProfileContextType = {
  profile: any | null;
  company: any | null;
  isAdmin: boolean;
  /**
   * Explicit role for the current user.
   *
   * NOTE:
   * - Currently derived from `profile.role` / admin status.
   * - Backend remains the source of truth; this is for UI convenience only.
   */
  userRole: import("@/types/roles").UserRole | null;
  /**
   * Check if current user has a given permission key.
   *
   * This is a thin wrapper around the permission utility so components don't
   * need to import it directly.
   */
  hasPermission: (permission: keyof import("@/types/roles").RolePermissions) => boolean;
  loading: boolean;
  user: any | null;
  sessionReady: boolean;
  error: string | null;
  reloadProfile: () => Promise<void>;
};

// Only export the context here (no components in this file)
export const ProfileContext = createContext<ProfileContextType | undefined>(
  undefined
);
