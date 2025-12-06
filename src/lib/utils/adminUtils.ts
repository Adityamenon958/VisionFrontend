/**
 * Utility function to check if a user is an admin of a company
 * Admin is determined by: profile.email === company.admin_email
 */
export const isUserAdmin = (profile: any, company: any): boolean => {
  if (!profile || !company) return false;
  return profile.email === company.admin_email;
};

