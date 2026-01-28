/**
 * Utility function to check if a user is an admin of a company
 * Admin is determined by:
 * 1. profile.role === 'platform_admin' or 'workspace_admin' (new role system)
 * 2. profile.role === 'admin' (legacy role - maps to workspace_admin)
 * 3. OR profile.email === company.admin_email (backward compatibility)
 */
export const isUserAdmin = (profile: any, company: any): boolean => {
  if (!profile || !company) return false;
  
  // Primary check: new role system
  if (profile.role === 'platform_admin' || profile.role === 'workspace_admin') {
    return true;
  }
  
  // Legacy role check
  if (profile.role === 'admin') {
    return true;
  }
  
  // Backward compatibility: email-based check
  if (profile.email === company.admin_email) {
    return true;
  }
  
  return false;
};


