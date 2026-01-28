# Frontend Authentication Headers Implementation Plan

## Overview
Backend requires user information to be sent in custom headers instead of validating JWT tokens with Supabase. This plan outlines all frontend changes needed.

---

## Current State Analysis

### Current Implementation
- **File**: `src/lib/api/config.ts`
- **Function**: `getAuthHeaders()` - Currently only sends `Authorization: Bearer <token>`
- **Usage**: Called by `apiRequest()` for all API calls

### Company Name Access Pattern
- Company name is accessed via: `company?.name` or `profile?.companies?.name`
- Company data is loaded in `ProfileContext` from Supabase `companies` table
- Company UUID is stored in `profile.company_id`

---

## Required Changes

### Phase 1: Update `getAuthHeaders()` Function

**File**: `src/lib/api/config.ts`

**Current Code** (lines 20-35):
```typescript
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};
```

**New Implementation**:
```typescript
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  // Get Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  const token = session?.access_token;
  const userId = session.user.id;

  // Get user profile with role and company info
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, company_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[getAuthHeaders] Error fetching profile:", profileError);
    // Fallback: continue with session data only
  }

  // Get company name if company_id exists
  let companyName: string | null = null;
  if (profile?.company_id) {
    const { data: companyData } = await supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .maybeSingle();
    
    companyName = companyData?.name || null;
  }

  // Build headers
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Always send Authorization header (for audit/logging)
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Send user information in custom headers
  if (profile) {
    headers["X-User-Id"] = profile.id || userId;
    headers["X-User-Role"] = profile.role || "viewer"; // Default to viewer if no role
    headers["X-User-Email"] = profile.email || session.user.email || "";
    
    if (profile.company_id) {
      headers["X-User-Company-Id"] = profile.company_id;
    }
    
    if (companyName) {
      headers["X-User-Company"] = companyName;
    }
  } else {
    // Fallback if profile fetch fails
    headers["X-User-Id"] = userId;
    headers["X-User-Email"] = session.user.email || "";
    headers["X-User-Role"] = "viewer"; // Default role
  }

  return headers;
};
```

**Alternative: Cached Approach** (Better Performance)
```typescript
// Cache profile data to avoid repeated Supabase calls
let cachedProfile: {
  id: string;
  email: string;
  role: string;
  company_id: string | null;
  company: string | null;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getAuthHeaders = async (): Promise<HeadersInit> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  const token = session?.access_token;
  const userId = session.user.id;

  // Check cache
  const now = Date.now();
  if (cachedProfile && (now - cachedProfile.timestamp) < CACHE_DURATION) {
    // Use cached data
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-User-Id": cachedProfile.id,
      "X-User-Role": cachedProfile.role,
      "X-User-Email": cachedProfile.email,
    };

    if (cachedProfile.company_id) {
      headers["X-User-Company-Id"] = cachedProfile.company_id;
    }
    if (cachedProfile.company) {
      headers["X-User-Company"] = cachedProfile.company;
    }

    return headers;
  }

  // Fetch fresh data
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, company_id")
    .eq("id", userId)
    .maybeSingle();

  let companyName: string | null = null;
  if (profile?.company_id) {
    const { data: companyData } = await supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .maybeSingle();
    
    companyName = companyData?.name || null;
  }

  // Update cache
  if (profile) {
    cachedProfile = {
      id: profile.id || userId,
      email: profile.email || session.user.email || "",
      role: profile.role || "viewer",
      company_id: profile.company_id || null,
      company: companyName,
      timestamp: now,
    };
  }

  // Build headers
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  if (profile) {
    headers["X-User-Id"] = profile.id || userId;
    headers["X-User-Role"] = profile.role || "viewer";
    headers["X-User-Email"] = profile.email || session.user.email || "";
    
    if (profile.company_id) {
      headers["X-User-Company-Id"] = profile.company_id;
    }
    if (companyName) {
      headers["X-User-Company"] = companyName;
    }
  } else {
    headers["X-User-Id"] = userId;
    headers["X-User-Email"] = session.user.email || "";
    headers["X-User-Role"] = "viewer";
  }

  return headers;
};

// Function to clear cache (call after role updates, profile changes, etc.)
export const clearAuthCache = () => {
  cachedProfile = null;
};
```

---

### Phase 2: Enhanced 401 Error Handling

**File**: `src/lib/api/config.ts`

**Current Code** (lines 121-126):
```typescript
// Handle 401 Unauthorized
if (response.status === 401) {
  await supabase.auth.signOut();
  window.location.href = "/login";
  throw new Error("Unauthorized - please log in again");
}
```

**New Implementation**:
```typescript
// Handle 401 Unauthorized
if (response.status === 401) {
  // Check if session is still valid
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    // Session expired, redirect to login
    await supabase.auth.signOut();
    window.location.href = "/login";
    throw new Error("Unauthorized - please log in again");
  }
  
  // Try to refresh session
  const { data: { session: newSession }, error: refreshError } = 
    await supabase.auth.refreshSession();
  
  if (newSession && !refreshError) {
    // Session refreshed, clear cache and retry request
    clearAuthCache(); // If using cached approach
    // Note: Retry logic would need to be implemented in fetchWithRetry
    // For now, just throw error and let caller handle retry
    throw new Error("Session refreshed - please retry");
  } else {
    // Refresh failed, redirect to login
    await supabase.auth.signOut();
    window.location.href = "/login";
    throw new Error("Unauthorized - please log in again");
  }
}
```

**Alternative: Retry with Refreshed Token** (More Advanced):
```typescript
// In apiRequest function, after 401 handling:
if (response.status === 401) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    const { data: { session: newSession } } = 
      await supabase.auth.refreshSession();
    
    if (newSession) {
      clearAuthCache(); // Clear cache
      // Retry the request with new token
      const retryHeaders = await getAuthHeaders();
      const retryResponse = await fetchWithRetry(url, {
        ...options,
        headers: { ...retryHeaders, ...options.headers },
        signal: options.signal,
      });
      
      // Continue with retry response
      response = retryResponse;
    } else {
      await supabase.auth.signOut();
      window.location.href = "/login";
      throw new Error("Unauthorized - please log in again");
    }
  } else {
    await supabase.auth.signOut();
    window.location.href = "/login";
    throw new Error("Unauthorized - please log in again");
  }
}
```

---

### Phase 3: Clear Cache on Profile/Role Updates

**Files to Update**:
1. `src/components/CompanyMembers.tsx` - After role update
2. `src/contexts/ProfileContext.tsx` - After profile reload
3. Any component that updates user profile

**Implementation**:

**In `src/lib/api/config.ts`** (add export):
```typescript
export const clearAuthCache = () => {
  cachedProfile = null;
};
```

**In `src/components/CompanyMembers.tsx`** (after successful role update):
```typescript
import { clearAuthCache } from "@/lib/api/config";

// In handleRoleChange function, after successful update:
await updateUserRole(memberId, newRole);
clearAuthCache(); // Clear cache so next request gets fresh role
```

**In `src/contexts/ProfileContext.tsx`** (after profile reload):
```typescript
import { clearAuthCache } from "@/lib/api/config";

// In loadProfile function, after setting profile:
setProfile(profileData);
clearAuthCache(); // Clear cache to ensure fresh data
```

---

### Phase 4: Handle Edge Cases

**File**: `src/lib/api/config.ts`

**Add Error Handling for Profile Fetch**:
```typescript
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Not authenticated");
    }

    const token = session?.access_token;
    const userId = session.user.id;

    // Try to get profile, but don't fail if it doesn't exist
    let profile: any = null;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, company_id")
        .eq("id", userId)
        .maybeSingle();
      
      if (!error && data) {
        profile = data;
      }
    } catch (profileError) {
      console.warn("[getAuthHeaders] Could not fetch profile:", profileError);
      // Continue with session data only
    }

    // Get company name (with error handling)
    let companyName: string | null = null;
    if (profile?.company_id) {
      try {
        const { data: companyData } = await supabase
          .from("companies")
          .select("name")
          .eq("id", profile.company_id)
          .maybeSingle();
        
        companyName = companyData?.name || null;
      } catch (companyError) {
        console.warn("[getAuthHeaders] Could not fetch company:", companyError);
        // Continue without company name
      }
    }

    // Build headers with fallbacks
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Always include required headers (with defaults if needed)
    headers["X-User-Id"] = profile?.id || userId;
    headers["X-User-Role"] = profile?.role || "viewer";
    headers["X-User-Email"] = profile?.email || session.user.email || "";

    if (profile?.company_id) {
      headers["X-User-Company-Id"] = profile.company_id;
    }

    if (companyName) {
      headers["X-User-Company"] = companyName;
    }

    return headers;
  } catch (error) {
    console.error("[getAuthHeaders] Error:", error);
    // Return minimal headers to prevent complete failure
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    return {
      "Content-Type": "application/json",
      "Authorization": session?.access_token ? `Bearer ${session.access_token}` : "",
      "X-User-Id": session?.user?.id || "",
      "X-User-Role": "viewer",
      "X-User-Email": session?.user?.email || "",
    };
  }
};
```

---

## Files to Modify

### Primary Changes
1. **`src/lib/api/config.ts`**
   - Update `getAuthHeaders()` function
   - Add caching mechanism (optional but recommended)
   - Add `clearAuthCache()` function
   - Enhance 401 error handling

### Secondary Changes (Cache Clearing)
2. **`src/components/CompanyMembers.tsx`**
   - Import `clearAuthCache`
   - Call `clearAuthCache()` after successful role update

3. **`src/contexts/ProfileContext.tsx`**
   - Import `clearAuthCache`
   - Call `clearAuthCache()` after profile reload

---

## Implementation Order

1. **Step 1**: Update `getAuthHeaders()` in `src/lib/api/config.ts`
   - Add profile fetch logic
   - Add company name fetch logic
   - Add custom headers
   - Add error handling

2. **Step 2**: Add caching (optional but recommended)
   - Implement cache mechanism
   - Add `clearAuthCache()` function

3. **Step 3**: Enhance 401 handling
   - Add session refresh logic
   - Add retry mechanism (optional)

4. **Step 4**: Add cache clearing calls
   - In `CompanyMembers.tsx` after role update
   - In `ProfileContext.tsx` after profile reload

5. **Step 5**: Test all API calls
   - Verify headers are sent correctly
   - Verify 401 handling works
   - Verify cache clearing works

---

## Testing Checklist

### Header Verification
- [ ] `Authorization: Bearer <token>` is sent
- [ ] `X-User-Id` is sent with correct user UUID
- [ ] `X-User-Role` is sent with correct role (or "viewer" default)
- [ ] `X-User-Email` is sent with correct email
- [ ] `X-User-Company-Id` is sent when user has company
- [ ] `X-User-Company` is sent when company name exists

### Error Handling
- [ ] Missing session returns error
- [ ] Profile fetch failure doesn't break API calls
- [ ] Company fetch failure doesn't break API calls
- [ ] 401 response triggers session refresh
- [ ] Session refresh failure redirects to login

### Cache Management
- [ ] Cache is used for subsequent requests
- [ ] Cache is cleared after role update
- [ ] Cache is cleared after profile reload
- [ ] Cache expires after 5 minutes

### Edge Cases
- [ ] User without profile still works (defaults to "viewer")
- [ ] User without company still works (no company headers)
- [ ] User with null role defaults to "viewer"
- [ ] Multiple rapid API calls use cache

---

## Performance Considerations

### Current Approach (No Cache)
- **Pros**: Always fresh data
- **Cons**: 2 Supabase queries per API call (profile + company)

### Cached Approach (Recommended)
- **Pros**: Faster API calls, reduced Supabase load
- **Cons**: Stale data if profile/role changes (mitigated by cache clearing)

### Recommendation
**Use cached approach** with:
- 5-minute cache duration
- Cache clearing on profile/role updates
- Fallback to fresh fetch if cache fails

---

## Security Considerations

### Current Implementation
- Frontend sends user info in headers
- Backend trusts these headers
- No token validation on backend

### Recommendations
1. **Frontend Validation**: Always validate session before sending headers
2. **Error Handling**: Don't expose sensitive errors to users
3. **Logging**: Backend should log all requests with user info for audit
4. **Rate Limiting**: Backend should implement rate limiting per user
5. **Request Signing**: Consider adding request signatures in future (optional)

---

## Backward Compatibility

### Breaking Changes
- None - All changes are additive
- Existing API calls will continue to work
- New headers are added, not replacing existing ones

### Migration Path
1. Deploy frontend changes
2. Backend starts reading new headers
3. Backend stops validating JWT (optional, can keep for audit)
4. Monitor for any issues

---

## Summary

**Total Files to Modify**: 3
- `src/lib/api/config.ts` (primary)
- `src/components/CompanyMembers.tsx` (cache clearing)
- `src/contexts/ProfileContext.tsx` (cache clearing)

**New Functions**: 1
- `clearAuthCache()` (if using cached approach)

**New Headers**: 5
- `X-User-Id`
- `X-User-Role`
- `X-User-Email`
- `X-User-Company-Id` (optional)
- `X-User-Company` (optional)

**Estimated Implementation Time**: 2-3 hours

**Risk Level**: Low (additive changes, backward compatible)
