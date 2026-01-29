# Frontend Supabase Role Update Implementation Plan

## Overview
Since the backend has removed Supabase dependencies, the frontend must update Supabase directly when roles are changed. This plan outlines the changes needed.

---

## Current Flow

1. User changes role in `CompanyMembers.tsx`
2. Frontend calls `updateUserRole()` → Backend API `PUT /api/users/:userId/role`
3. Backend validates permissions and returns success
4. **Missing**: Supabase update (backend no longer does this)

---

## Required Changes

### Option 1: Update Supabase After Backend Success (Recommended)

**Flow:**
1. Call backend API (for validation/authorization)
2. If backend succeeds → Update Supabase directly
3. If Supabase update fails → Show error, backend state may be inconsistent

**Pros:**
- Backend still validates permissions
- Backend can log/audit the change
- Clear separation of concerns

**Cons:**
- Two operations (backend + Supabase)
- Potential inconsistency if Supabase update fails

---

### Option 2: Update Supabase First, Then Backend

**Flow:**
1. Update Supabase directly
2. Call backend API (for validation/audit)
3. If backend fails → Rollback Supabase (complex)

**Pros:**
- Supabase is source of truth
- Immediate update

**Cons:**
- Complex rollback logic
- Backend validation happens after update

---

### Option 3: Update Supabase Only (If Backend Doesn't Need Role Info)

**Flow:**
1. Update Supabase directly
2. Skip backend API call (or make it optional)

**Pros:**
- Simple, single operation
- No inconsistency risk

**Cons:**
- No backend validation/audit
- Backend won't know about role changes

---

## Recommended Implementation: Option 1

### Changes Required

#### 1. Update `src/lib/api/users.ts`

**Current Code:**
```typescript
export const updateUserRole = async (
  userId: string,
  role: UserRole
): Promise<{ success: boolean; message: string }> => {
  return apiRequest(`/users/${encodeURIComponent(userId)}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
};
```

**New Implementation:**
```typescript
import { supabase } from "@/integrations/supabase/client";
import { apiRequest } from "./config";
import type { UserRole } from "@/types/roles";

/**
 * Update user role
 * Updates both backend (for validation/audit) and Supabase (source of truth)
 * @param userId - The user ID whose role should be updated
 * @param role - The new role to assign
 */
export const updateUserRole = async (
  userId: string,
  role: UserRole
): Promise<{ success: boolean; message: string }> => {
  // Step 1: Call backend API for validation/authorization
  let backendSuccess = false;
  try {
    await apiRequest(`/users/${encodeURIComponent(userId)}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
    backendSuccess = true;
  } catch (backendError: any) {
    // Backend validation failed - don't update Supabase
    throw new Error(backendError.message || "Backend validation failed");
  }

  // Step 2: Update Supabase directly (backend has no Supabase dependency)
  const { error: supabaseError } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (supabaseError) {
    // Supabase update failed - log error
    console.error("[updateUserRole] Supabase update failed:", supabaseError);
    throw new Error(
      `Role update validated but failed to save: ${supabaseError.message}`
    );
  }

  return {
    success: true,
    message: "User role updated successfully",
  };
};
```

---

#### 2. Update `src/components/CompanyMembers.tsx`

**Current Code** (lines 163-182):
```typescript
try {
  await updateUserRole(memberId, newRole);

  // Clear auth cache to ensure fresh role data on next API call
  clearAuthCache();

  // Update local state
  setMembers((prevMembers) =>
    prevMembers.map((member) =>
      member.id === memberId ? { ...member, role: newRole } : member
    )
  );

  toast({
    title: "Role updated",
    description: `User role has been updated to ${getRoleDisplayName(newRole, undefined)}.`,
  });

  // Refresh members list to get latest data
  await fetchMembers();
}
```

**New Implementation** (no changes needed - `updateUserRole` now handles Supabase):
```typescript
// No changes needed - updateUserRole() now handles Supabase update
// The existing code will work as-is
```

---

### Alternative: If Backend API is Optional

If the backend doesn't need to know about role changes, you can simplify:

**Simplified `updateUserRole()`:**
```typescript
import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/types/roles";

/**
 * Update user role in Supabase
 * @param userId - The user ID whose role should be updated
 * @param role - The new role to assign
 */
export const updateUserRole = async (
  userId: string,
  role: UserRole
): Promise<{ success: boolean; message: string }> => {
  // Update Supabase directly
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    console.error("[updateUserRole] Supabase update failed:", error);
    throw new Error(`Failed to update role: ${error.message}`);
  }

  return {
    success: true,
    message: "User role updated successfully",
  };
};
```

**Note:** This removes backend validation. Only use if backend doesn't need role info.

---

## Error Handling Considerations

### Scenario 1: Backend Succeeds, Supabase Fails
- **Current State**: Backend validated, but Supabase not updated
- **User Experience**: Show error message
- **Data State**: Inconsistent (backend thinks role changed, Supabase doesn't)
- **Recovery**: User can retry, or backend needs to handle this

### Scenario 2: Backend Fails, Supabase Not Called
- **Current State**: No changes made
- **User Experience**: Show backend error
- **Data State**: Consistent (no changes)
- **Recovery**: User fixes issue and retries

---

## Security Considerations

### Permission Validation
- **Option 1**: Backend validates permissions before Supabase update
- **Option 3**: Frontend must validate permissions (less secure)

### Recommendation
Use **Option 1** to maintain backend validation while updating Supabase directly.

---

## Testing Checklist

- [ ] Backend API validates permissions correctly
- [ ] Supabase update succeeds after backend validation
- [ ] Error handling works if backend fails
- [ ] Error handling works if Supabase fails
- [ ] Cache is cleared after successful update
- [ ] UI reflects updated role immediately
- [ ] Member list refresh shows correct role
- [ ] Role persists after page reload

---

## Files to Modify

1. **`src/lib/api/users.ts`** (Primary)
   - Add Supabase update after backend success
   - Add error handling for both operations

2. **`src/components/CompanyMembers.tsx`** (No changes needed)
   - Existing code will work with updated `updateUserRole()`

---

## Implementation Steps

1. **Step 1**: Update `updateUserRole()` in `src/lib/api/users.ts`
   - Add Supabase import
   - Add Supabase update after backend success
   - Add error handling

2. **Step 2**: Test the flow
   - Test successful role update
   - Test backend validation failure
   - Test Supabase update failure

3. **Step 3**: Verify Supabase
   - Check `profiles` table after role change
   - Verify role column is updated correctly

---

## Summary

**Recommended Approach**: Option 1 (Backend validation + Supabase update)

**Changes Required**: 1 file (`src/lib/api/users.ts`)

**Complexity**: Low (add Supabase update after backend call)

**Risk**: Medium (potential inconsistency if Supabase fails after backend succeeds)

**Mitigation**: Clear error messages, allow retry, consider transaction pattern if needed
