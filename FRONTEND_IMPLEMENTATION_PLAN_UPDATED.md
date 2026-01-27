# **Frontend Implementation Plan - Updated with Backend Coordination**

## **Status: ~90% Aligned - Ready for Implementation**

This document incorporates backend coordination notes and clarifications. The frontend plan aligns with the backend plan, with a few items requiring backend confirmation before implementation.

---

## **Table of Contents**

1. [Pre-Implementation Checklist](#pre-implementation-checklist)
2. [Authentication Setup (CRITICAL - Do First)](#authentication-setup-critical---do-first)
3. [Roles and Permissions](#roles-and-permissions)
4. [Admin Governance Features](#admin-governance-features)
5. [Dashboard Enhancements](#dashboard-enhancements)
6. [Analytics and Monitoring](#analytics-and-monitoring)
7. [Implementation Phases](#implementation-phases)
8. [API Endpoints Reference](#api-endpoints-reference)
9. [Questions for Backend Team](#questions-for-backend-team)

---

## **Pre-Implementation Checklist**

### **Before Starting Implementation:**

- [ ] **Coordinate with backend on authentication mechanism** (CRITICAL)
  - How to send auth token? (JWT in `Authorization: Bearer` header? Session cookie?)
  - What endpoint returns current user info with role?
  - What happens if token is invalid/expired?
  - How to refresh tokens?

- [ ] **Get example API responses** for:
  - `/api/dashboard/overview`
  - `/api/analytics/training/:modelId`
  - `/api/users`
  - `/api/auth/me` (or equivalent user profile endpoint)

- [ ] **Clarify analytics chart endpoints:**
  - Does `/api/analytics/training/:modelId` return all chart data in one response?
  - Or should we request separate endpoints for each chart type?

- [ ] **Clarify dashboard trends:**
  - Does `/api/dashboard/overview` include trends data?
  - Or do we need a separate `/api/dashboard/trends` endpoint?

- [ ] **Confirm CORS and headers:**
  - Any special headers required?
  - CORS configuration for frontend origin?

---

## **Authentication Setup (CRITICAL - Do First)**

### **Current State**

The frontend currently uses Supabase authentication:
- Token retrieved from `supabase.auth.getSession()`
- Token sent in `Authorization: Bearer <token>` header
- Token stored in localStorage via Supabase client

### **Required Changes**

After migrating from Supabase to MongoDB, authentication will change. **Coordinate with backend team** on:

#### **A. Authentication Method**

**Option 1: JWT Token (Recommended)**
- Backend returns JWT token on login
- Frontend stores token in localStorage
- Frontend sends token in `Authorization: Bearer <token>` header
- Backend validates token on each request

**Option 2: Session Cookie**
- Backend sets HTTP-only cookie on login
- Frontend sends cookie automatically with requests
- Backend validates cookie on each request

**Action Required:** Confirm with backend which method they're using.

#### **B. Token Management**

**File:** `src/lib/api/config.ts` (UPDATE)

**Current Implementation:**
```typescript
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
```

**New Implementation (after backend confirmation):**
```typescript
// Option 1: JWT Token from localStorage
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = localStorage.getItem('auth_token'); // or 'access_token'
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Option 2: Session Cookie (no header needed)
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  return {}; // Cookie sent automatically
};
```

#### **C. User Profile Endpoint**

**File:** `src/lib/api/auth.ts` (NEW or UPDATE)

**Required Endpoint:**
- `GET /api/auth/me` - Returns current user info with role

**Expected Response:**
```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
  };
  profile: {
    id: string;
    role: 'platform_admin' | 'workspace_admin' | 'ml_engineer' | 'operator' | 'viewer';
    company_id: string | null;
    // ... other profile fields
  };
  company: {
    id: string;
    name: string;
    // ... other company fields
  } | null;
}
```

**Action Required:** Confirm endpoint path and response format with backend.

#### **D. Token Refresh**

**File:** `src/lib/api/auth.ts` (NEW)

**Required Endpoint:**
- `POST /api/auth/refresh` - Refresh access token

**Implementation:**
- Check token expiration before API calls
- Call refresh endpoint if expired
- Update token in localStorage
- Retry original request

**Action Required:** Confirm refresh endpoint and flow with backend.

#### **E. ProfileContext Updates**

**File:** `src/contexts/ProfileContext.tsx` (UPDATE)

**Changes:**
- Replace Supabase session check with API call to `/api/auth/me`
- Store user role from API response
- Handle token expiration (redirect to login)
- Handle 401 responses (token invalid)

**Implementation Steps:**
1. Remove Supabase dependency from ProfileContext
2. Add API call to get user profile
3. Store role in context state
4. Update all components using `isAdmin` to use role-based checks

---

## **Roles and Permissions**

### **Role Types**

**File:** `src/types/roles.ts` (NEW)

```typescript
export type UserRole = 
  | 'platform_admin'    // Global configuration management
  | 'workspace_admin'   // Project and user management
  | 'ml_engineer'       // Dataset management, training, hyperparameters
  | 'operator'          // Inference execution and monitoring
  | 'viewer';           // Read-only access

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
```

### **Permission Utilities**

**File:** `src/lib/utils/permissions.ts` (NEW)

```typescript
export const getRolePermissions = (role: UserRole): RolePermissions => {
  const permissions: RolePermissions = {
    manageGlobalConfig: false,
    removeUsers: false,
    manageWorkspace: false,
    manageProjects: false,
    manageWorkspaceUsers: false,
    assignRoles: false,
    deleteProjects: false,
    manageDatasets: false,
    startTraining: false,
    tuneHyperparameters: false,
    viewTrainingMetrics: false,
    runInference: false,
    monitorInference: false,
    viewInferenceResults: false,
    viewProjects: false,
    viewDatasets: false,
    viewModels: false,
    viewInference: false,
  };

  switch (role) {
    case 'platform_admin':
      permissions.manageGlobalConfig = true;
      permissions.removeUsers = true;
      permissions.manageWorkspace = true;
      permissions.manageProjects = true;
      permissions.manageWorkspaceUsers = true;
      permissions.assignRoles = true;
      permissions.deleteProjects = true;
      permissions.manageDatasets = true;
      permissions.startTraining = true;
      permissions.tuneHyperparameters = true;
      permissions.viewTrainingMetrics = true;
      permissions.runInference = true;
      permissions.monitorInference = true;
      permissions.viewInferenceResults = true;
      permissions.viewProjects = true;
      permissions.viewDatasets = true;
      permissions.viewModels = true;
      permissions.viewInference = true;
      break;

    case 'workspace_admin':
      permissions.manageWorkspace = true;
      permissions.manageProjects = true;
      permissions.manageWorkspaceUsers = true;
      permissions.assignRoles = true;
      permissions.deleteProjects = true;
      permissions.manageDatasets = true;
      permissions.startTraining = true;
      permissions.tuneHyperparameters = true;
      permissions.viewTrainingMetrics = true;
      permissions.runInference = true;
      permissions.monitorInference = true;
      permissions.viewInferenceResults = true;
      permissions.viewProjects = true;
      permissions.viewDatasets = true;
      permissions.viewModels = true;
      permissions.viewInference = true;
      break;

    case 'ml_engineer':
      permissions.manageDatasets = true;
      permissions.startTraining = true;
      permissions.tuneHyperparameters = true;
      permissions.viewTrainingMetrics = true;
      permissions.runInference = true;
      permissions.monitorInference = true;
      permissions.viewInferenceResults = true;
      permissions.viewProjects = true;
      permissions.viewDatasets = true;
      permissions.viewModels = true;
      permissions.viewInference = true;
      break;

    case 'operator':
      permissions.runInference = true;
      permissions.monitorInference = true;
      permissions.viewInferenceResults = true;
      permissions.viewProjects = true;
      permissions.viewDatasets = true;
      permissions.viewModels = true;
      permissions.viewInference = true;
      break;

    case 'viewer':
      permissions.viewProjects = true;
      permissions.viewDatasets = true;
      permissions.viewModels = true;
      permissions.viewInference = true;
      break;
  }

  return permissions;
};

export const hasPermission = (userRole: UserRole, permission: keyof RolePermissions): boolean => {
  const permissions = getRolePermissions(userRole);
  return permissions[permission] === true;
};
```

### **ProfileContext Updates**

**File:** `src/contexts/ProfileContext.tsx` (UPDATE)

**Add:**
- `userRole: UserRole | null` state
- `permissions: RolePermissions | null` state
- `hasPermission(permission: string): boolean` helper function

**Update `loadProfile` function:**
- Extract role from API response
- Compute permissions from role
- Store in context state

### **Permission Components**

**File:** `src/components/permissions/ProtectedComponent.tsx` (NEW)

```typescript
interface ProtectedComponentProps {
  requiredPermission?: keyof RolePermissions;
  requiredRole?: UserRole;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  requiredPermission,
  requiredRole,
  fallback,
  children,
}) => {
  const { userRole, hasPermission } = useProfile();

  if (!userRole) {
    return fallback || null;
  }

  if (requiredRole && userRole !== requiredRole) {
    return fallback || null;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || null;
  }

  return <>{children}</>;
};
```

### **Route Protection**

**File:** `src/components/auth/RoleProtectedRoute.tsx` (NEW)

```typescript
interface RoleProtectedRouteProps {
  requiredRole?: UserRole;
  requiredPermission?: keyof RolePermissions;
  children: React.ReactNode;
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  requiredRole,
  requiredPermission,
  children,
}) => {
  const { userRole, hasPermission } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userRole) {
      navigate('/auth');
      return;
    }

    if (requiredRole && userRole !== requiredRole) {
      navigate('/dashboard');
      return;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      navigate('/dashboard');
      return;
    }
  }, [userRole, requiredRole, requiredPermission, navigate, hasPermission]);

  if (!userRole) return null;
  if (requiredRole && userRole !== requiredRole) return null;
  if (requiredPermission && !hasPermission(requiredPermission)) return null;

  return <>{children}</>;
};
```

---

## **Admin Governance Features**

### **1. Company Details Management**

**API Endpoints:**
- `GET /api/companies/:companyId` - Get company details
- `PUT /api/companies/:companyId` - Update company details

**File:** `src/lib/api/companies.ts` (NEW)

```typescript
export const getCompany = async (companyId: string) => {
  return apiRequest(`/companies/${companyId}`);
};

export const updateCompany = async (companyId: string, data: {
  name?: string;
  description?: string;
  contact_email?: string;
  // ... other fields
}) => {
  return apiRequest(`/companies/${companyId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};
```

**File:** `src/pages/SettingsWorkspacePage.tsx` (UPDATE)

**Add:**
- Form to edit company details
- Save functionality
- Validation
- Success/error handling

### **2. User Removal**

**API Endpoints:**
- `DELETE /api/users/:userId` - Remove user from workspace

**File:** `src/lib/api/users.ts` (NEW)

```typescript
export const removeUser = async (userId: string) => {
  return apiRequest(`/users/${userId}`, {
    method: 'DELETE',
  });
};
```

**File:** `src/components/admin/RemoveUserDialog.tsx` (NEW)

**Features:**
- User selection
- Confirmation message
- Impact warning
- Remove button

**File:** `src/pages/TeamMembersPage.tsx` (UPDATE)

**Add:**
- "Remove" button (Workspace Admin only)
- Remove user dialog
- Call remove API
- Refresh list after removal

### **3. Enhanced Project Deletion**

**API Endpoints:**
- `GET /api/projects/:projectId/dependencies` - Get linked artifacts
- `DELETE /api/projects/:projectId` - Delete project

**File:** `src/lib/api/projects.ts` (UPDATE)

```typescript
export const getProjectDependencies = async (projectId: string) => {
  return apiRequest(`/projects/${projectId}/dependencies`);
};

export const deleteProject = async (projectId: string) => {
  return apiRequest(`/projects/${projectId}`, {
    method: 'DELETE',
  });
};
```

**File:** `src/components/projects/DeleteProjectDialog.tsx` (NEW)

**Features:**
- Show project details
- List linked artifacts (datasets, models, inference jobs)
- Confirmation checkbox
- Delete button

### **4. Audit Log**

**API Endpoints:**
- `GET /api/audit/log` - Get audit log entries
  - Query params: `?startDate=...&endDate=...&userId=...&actionType=...&resourceType=...&page=...&limit=...`

**File:** `src/lib/api/audit.ts` (NEW)

```typescript
export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  actionType?: string;
  resourceType?: string;
  page?: number;
  limit?: number;
}

export const getAuditLog = async (filters: AuditLogFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, String(value));
    }
  });
  return apiRequest(`/audit/log?${params.toString()}`);
};
```

**File:** `src/pages/AdminAuditLog.tsx` (NEW)

**Features:**
- Audit log table
- Filters (date range, user, action type, resource type)
- Search
- Pagination
- Export to CSV/JSON

### **5. Analytics Dashboard**

**API Endpoints:**
- `GET /api/analytics/overview` - Get analytics overview
- `GET /api/analytics/activity` - Get activity metrics
- `GET /api/analytics/trends` - Get trend data (if separate endpoint)

**File:** `src/lib/api/analytics.ts` (NEW)

```typescript
export const getAnalyticsOverview = async () => {
  return apiRequest('/analytics/overview');
};

export const getActivityMetrics = async (dateRange?: { start: string; end: string }) => {
  const params = dateRange ? new URLSearchParams({
    startDate: dateRange.start,
    endDate: dateRange.end,
  }) : new URLSearchParams();
  return apiRequest(`/analytics/activity?${params.toString()}`);
};

export const getTrends = async (dateRange?: { start: string; end: string }) => {
  const params = dateRange ? new URLSearchParams({
    startDate: dateRange.start,
    endDate: dateRange.end,
  }) : new URLSearchParams();
  return apiRequest(`/analytics/trends?${params.toString()}`);
};
```

**File:** `src/pages/AdminAnalytics.tsx` (NEW)

**Features:**
- User activity metrics
- Project creation trends
- Dataset upload trends
- Training job statistics
- Inference statistics
- Charts/graphs
- Date range selector
- Export options

---

## **Dashboard Enhancements**

### **API Endpoints**

- `GET /api/dashboard/overview` - Get dashboard overview data
- `GET /api/dashboard/activity` - Get recent activity
- `GET /api/dashboard/projects` - Get projects summary

**Note:** Confirm with backend if `/api/dashboard/overview` includes trends, or if separate `/api/dashboard/trends` endpoint is needed.

### **File:** `src/lib/api/dashboard.ts` (NEW)

```typescript
export const getDashboardOverview = async () => {
  return apiRequest('/dashboard/overview');
};

export const getDashboardActivity = async (limit: number = 10) => {
  return apiRequest(`/dashboard/activity?limit=${limit}`);
};

export const getDashboardProjects = async () => {
  return apiRequest('/dashboard/projects');
};

// If trends are separate endpoint:
export const getDashboardTrends = async (dateRange?: { start: string; end: string }) => {
  const params = dateRange ? new URLSearchParams({
    startDate: dateRange.start,
    endDate: dateRange.end,
  }) : new URLSearchParams();
  return apiRequest(`/dashboard/trends?${params.toString()}`);
};
```

### **Welcome Section**

**File:** `src/components/dashboard/WelcomeSection.tsx` (NEW)

**Features:**
- Greeting with user name
- User role badge
- Platform capabilities summary
- Quick tips/onboarding
- Dismissible

### **Enhanced Metrics Cards**

**File:** `src/components/dashboard/MetricCard.tsx` (UPDATE)

**Add:**
- Trend indicators (up/down arrows)
- Percentage change
- Click handlers (navigate to details)
- Loading skeletons
- Error states

### **Quick Actions Panel**

**File:** `src/components/dashboard/QuickActionCard.tsx` (UPDATE)

**Add:**
- Role-based visibility
- Disable based on permissions
- Tooltips for disabled actions
- Icons
- Badges

### **Activity Feed**

**File:** `src/components/dashboard/ActivityFeed.tsx` (UPDATE)

**Add:**
- More activity types
- Filters (project, user, date)
- "View All" link
- Activity details modal
- Real-time updates (polling)

---

## **Analytics and Monitoring**

### **API Endpoints**

**Training Analytics:**
- `GET /api/analytics/training/:modelId` - Get training metrics (includes all chart data)
- `GET /api/analytics/training/status` - Get training job status summary

**Inference Analytics:**
- `GET /api/analytics/inference/runs` - Get inference runs
- `GET /api/analytics/inference/pass-fail` - Get pass/fail statistics

**Accuracy Trends:**
- `GET /api/analytics/accuracy/trends` - Get accuracy trends over time

**Note:** Confirm with backend if `/api/analytics/training/:modelId` returns all chart data (confusion matrix, loss curve, precision-recall, mAP trends) in one response, or if separate endpoints are needed.

### **File:** `src/lib/api/analytics.ts` (UPDATE)

```typescript
// Training Analytics
export const getTrainingAnalytics = async (modelId: string) => {
  return apiRequest(`/analytics/training/${modelId}`);
};

export const getTrainingStatus = async () => {
  return apiRequest('/analytics/training/status');
};

// If separate chart endpoints are needed (coordinate with backend):
export const getConfusionMatrix = async (modelId: string) => {
  return apiRequest(`/analytics/training/${modelId}/confusion-matrix`);
};

export const getLossCurve = async (modelId: string) => {
  return apiRequest(`/analytics/training/${modelId}/loss-curve`);
};

export const getPrecisionRecall = async (modelId: string) => {
  return apiRequest(`/analytics/training/${modelId}/precision-recall`);
};

export const getMAPTrends = async (modelId: string) => {
  return apiRequest(`/analytics/training/${modelId}/map-trends`);
};

// Inference Analytics
export const getInferenceRuns = async (filters?: {
  projectId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}) => {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, String(value));
    }
  });
  return apiRequest(`/analytics/inference/runs?${params.toString()}`);
};

export const getInferencePassFail = async (filters?: {
  projectId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, String(value));
    }
  });
  return apiRequest(`/analytics/inference/pass-fail?${params.toString()}`);
};

// Accuracy Trends
export const getAccuracyTrends = async (filters?: {
  modelIds?: string[];
  startDate?: string;
  endDate?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.modelIds) {
    filters.modelIds.forEach(id => params.append('modelIds', id));
  }
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  return apiRequest(`/analytics/accuracy/trends?${params.toString()}`);
};
```

### **Analytics Page**

**File:** `src/pages/AnalyticsPage.tsx` (NEW)

**Features:**
- Tabs: Training Analytics, Inference Analytics, Model Comparison
- Date range selector
- Model/project filters
- Export options
- Full-screen mode for charts

### **Chart Components**

**Files to Create:**
- `src/components/analytics/ConfusionMatrix.tsx` (NEW)
- `src/components/analytics/LossCurveChart.tsx` (NEW)
- `src/components/analytics/PrecisionRecallChart.tsx` (NEW)
- `src/components/analytics/mAPTrendChart.tsx` (NEW)
- `src/components/analytics/AccuracyTrendChart.tsx` (NEW)

**Chart Library:** Use Recharts (recommended) or Chart.js

**Installation:**
```bash
npm install recharts
```

---

## **Implementation Phases**

### **Phase 1: Authentication Setup (Week 1) - CRITICAL**

**Prerequisites:**
- Coordinate with backend on authentication method
- Get example API responses
- Confirm token refresh flow

**Tasks:**
1. Update `src/lib/api/config.ts` with new auth method
2. Create/update `src/lib/api/auth.ts` for user profile endpoint
3. Update `src/contexts/ProfileContext.tsx` to use API instead of Supabase
4. Test authentication flow
5. Test token refresh
6. Test 401 handling

**Deliverables:**
- Working authentication
- User profile loading with role
- Token management

### **Phase 2: Roles and Permissions (Week 2)**

**Prerequisites:**
- Phase 1 complete
- User role available in ProfileContext

**Tasks:**
1. Create `src/types/roles.ts`
2. Create `src/lib/utils/permissions.ts`
3. Update ProfileContext with role and permissions
4. Create `src/components/permissions/ProtectedComponent.tsx`
5. Create `src/components/auth/RoleProtectedRoute.tsx`
6. Update `src/components/app-shell/AppSidebar.tsx` with role-based menu
7. Update routes in `src/App.tsx` with role protection
8. Test role-based access

**Deliverables:**
- Role system working
- Permission checks working
- UI elements show/hide based on role
- Routes protected by role

### **Phase 3: Admin Features (Week 3)**

**Prerequisites:**
- Phase 2 complete
- Roles working

**Tasks:**
1. Create `src/lib/api/companies.ts`
2. Update `src/pages/SettingsWorkspacePage.tsx` for company management
3. Create `src/lib/api/users.ts`
4. Create `src/components/admin/RemoveUserDialog.tsx`
5. Update `src/pages/TeamMembersPage.tsx` for user removal
6. Update `src/lib/api/projects.ts` for dependencies endpoint
7. Create `src/components/projects/DeleteProjectDialog.tsx`
8. Create `src/lib/api/audit.ts`
9. Create `src/pages/AdminAuditLog.tsx`
10. Create `src/pages/AdminAnalytics.tsx`

**Deliverables:**
- Company details management
- User removal
- Enhanced project deletion
- Audit log page
- Analytics dashboard

### **Phase 4: Dashboard Enhancements (Week 4)**

**Prerequisites:**
- Phase 2 complete (for role-based quick actions)

**Tasks:**
1. Create `src/lib/api/dashboard.ts`
2. Create `src/components/dashboard/WelcomeSection.tsx`
3. Update `src/components/dashboard/MetricCard.tsx`
4. Update `src/components/dashboard/QuickActionCard.tsx`
5. Update `src/components/dashboard/ActivityFeed.tsx`
6. Update `src/pages/Dashboard.tsx` layout
7. Update `src/hooks/useDashboardMetrics.ts`

**Deliverables:**
- Enhanced dashboard
- Welcome section
- Improved metrics cards
- Role-based quick actions
- Enhanced activity feed

### **Phase 5: Analytics and Monitoring (Week 5)**

**Prerequisites:**
- Phase 2 complete
- Backend analytics endpoints confirmed

**Tasks:**
1. Install chart library (Recharts)
2. Create `src/lib/api/analytics.ts` (update with confirmed endpoints)
3. Create `src/pages/AnalyticsPage.tsx`
4. Create chart components:
   - ConfusionMatrix.tsx
   - LossCurveChart.tsx
   - PrecisionRecallChart.tsx
   - mAPTrendChart.tsx
   - AccuracyTrendChart.tsx
5. Create `src/components/analytics/TrainingAnalytics.tsx`
6. Create `src/components/analytics/InferenceAnalytics.tsx`
7. Create `src/components/training/TrainingStatusTracker.tsx`
8. Create `src/components/inference/InferenceRunsTracker.tsx`
9. Integrate analytics into existing pages

**Deliverables:**
- Analytics page
- Training analytics charts
- Inference analytics charts
- Confusion matrix
- Trend charts
- Training/inference trackers

### **Phase 6: Testing and Polish (Week 6)**

**Tasks:**
1. End-to-end testing
2. Bug fixes
3. Performance optimization
4. UI/UX polish
5. Documentation

**Deliverables:**
- Fully tested features
- Bug-free implementation
- Optimized performance
- Polished UI/UX

---

## **API Endpoints Reference**

### **Authentication**
- `GET /api/auth/me` - Get current user info with role
- `POST /api/auth/refresh` - Refresh access token

### **Users**
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:userId` - Update user
- `DELETE /api/users/:userId` - Remove user
- `PUT /api/users/:userId/role` - Update user role

### **Companies**
- `GET /api/companies/:companyId` - Get company details
- `PUT /api/companies/:companyId` - Update company details

### **Projects**
- `GET /api/projects/:projectId/dependencies` - Get project dependencies
- `DELETE /api/projects/:projectId` - Delete project

### **Dashboard**
- `GET /api/dashboard/overview` - Get dashboard overview
- `GET /api/dashboard/activity` - Get recent activity
- `GET /api/dashboard/projects` - Get projects summary
- `GET /api/dashboard/trends` - Get trends (if separate endpoint)

### **Analytics**
- `GET /api/analytics/training/:modelId` - Get training metrics (all chart data)
- `GET /api/analytics/training/status` - Get training job status
- `GET /api/analytics/inference/runs` - Get inference runs
- `GET /api/analytics/inference/pass-fail` - Get pass/fail statistics
- `GET /api/analytics/accuracy/trends` - Get accuracy trends

### **Audit**
- `GET /api/audit/log` - Get audit log entries

---

## **Questions for Backend Team**

### **Critical Questions (Must Answer Before Phase 1)**

1. **Authentication:**
   - How should we send auth token? (JWT in `Authorization: Bearer` header? Session cookie?)
   - What endpoint returns current user info with role? (`/api/auth/me`?)
   - What happens if token is invalid/expired? (401 response? Redirect to login?)
   - How to refresh tokens? (`POST /api/auth/refresh`?)
   - Where to store token? (localStorage? Cookie?)

2. **User Profile:**
   - What fields are returned in user profile response?
   - Is role included in profile response?
   - How to get user's company info?

### **Important Questions (Answer Before Phase 3-5)**

3. **API Response Formats:**
   - Can you provide example responses for:
     - `/api/dashboard/overview`
     - `/api/analytics/training/:modelId`
     - `/api/users`
   - What error format do you use? (consistent error structure?)

4. **Analytics Charts:**
   - Does `/api/analytics/training/:modelId` return all chart data (confusion matrix, loss curve, precision-recall, mAP trends) in one response?
   - Or should we request separate endpoints for each chart type?
   - What format is the chart data? (JSON arrays? Specific structure?)

5. **Dashboard Trends:**
   - Does `/api/dashboard/overview` include trends data?
   - Or do we need a separate `/api/dashboard/trends` endpoint?

6. **CORS and Headers:**
   - Any special headers required?
   - CORS configuration for frontend origin?
   - Any rate limiting we should be aware of?

### **Nice to Have Questions**

7. **Real-time Updates:**
   - Do you support WebSocket for real-time updates?
   - Or should we use polling for activity feed?

8. **Pagination:**
   - What pagination format do you use? (page/limit? cursor-based?)
   - Default page size?

9. **Filtering:**
   - What filter formats do you support? (query params? JSON body?)
   - Date range format? (ISO strings? Unix timestamps?)

---

## **Summary**

### **Ready to Implement:**
- ✅ Roles and permissions system
- ✅ User management endpoints
- ✅ Company management endpoints
- ✅ Dashboard endpoints
- ✅ Analytics endpoints (structure confirmed)

### **Need Backend Confirmation:**
- ⚠️ Authentication mechanism (CRITICAL)
- ⚠️ Analytics chart endpoint structure (single vs separate)
- ⚠️ Dashboard trends endpoint (included vs separate)
- ⚠️ API response formats (examples needed)

### **Implementation Order:**
1. **Phase 1: Authentication** (CRITICAL - do first)
2. **Phase 2: Roles and Permissions** (after auth works)
3. **Phase 3: Admin Features** (after roles work)
4. **Phase 4: Dashboard** (can start in parallel)
5. **Phase 5: Analytics** (after dashboard)
6. **Phase 6: Testing and Polish**

### **Next Steps:**
1. Coordinate with backend on authentication (highest priority)
2. Get example API responses
3. Start Phase 1 (authentication setup)
4. Proceed with remaining phases once auth is working

---

**Last Updated:** Based on backend coordination notes
**Status:** Ready for implementation pending authentication clarification
