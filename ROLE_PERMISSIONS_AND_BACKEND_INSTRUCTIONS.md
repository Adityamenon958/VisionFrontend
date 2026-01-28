# Role-Based Access Control (RBAC) - Complete Guide

## 📋 Table of Contents
1. [Role Descriptions](#role-descriptions)
2. [Permission Matrix](#permission-matrix)
3. [Backend Implementation Instructions](#backend-implementation-instructions)

---

## 🎭 Role Descriptions

### 1. Platform Admin (`platform_admin`)
**Highest level of access - Global system administrator**

**What they can do:**
- ✅ **Global Configuration Management**: Configure platform-wide settings, system parameters, and global policies
- ✅ **User Management**: Remove users from the platform (platform-wide authority)
- ✅ **Workspace Management**: Create, update, and manage all workspaces
- ✅ **Project Management**: Create, edit, and delete projects across all workspaces
- ✅ **Workspace User Management**: Add/remove users from any workspace
- ✅ **Role Assignment**: Assign or update user roles (including other admins)
- ✅ **Project Deletion**: Delete any project and its linked artifacts
- ✅ **Dataset Management**: Upload, manage, and delete datasets
- ✅ **Model Training**: Start training jobs and tune hyperparameters
- ✅ **View Training Metrics**: Access all training metrics and analytics
- ✅ **Inference Operations**: Run inference, monitor jobs, and view results
- ✅ **View Everything**: Full read access to all projects, datasets, models, and inference results

**Use Case**: System administrators who need complete control over the platform.

---

### 2. Workspace Admin (`workspace_admin`)
**Workspace-level administrator**

**What they can do:**
- ✅ **Workspace Management**: Manage workspace settings, company details, and workspace configuration
- ✅ **Project Management**: Create, edit, and delete projects within their workspace
- ✅ **Workspace User Management**: Add/remove users from their workspace
- ✅ **Role Assignment**: Assign or update user roles within their workspace (cannot assign `platform_admin`)
- ✅ **Project Deletion**: Delete projects within their workspace (removes all linked artifacts)
- ✅ **Dataset Management**: Upload, manage, and delete datasets
- ✅ **Model Training**: Start training jobs and tune hyperparameters
- ✅ **View Training Metrics**: Access training metrics and analytics
- ✅ **Inference Operations**: Run inference, monitor jobs, and view results
- ✅ **View Everything**: Full read access to all workspace projects, datasets, models, and inference results

**Cannot do:**
- ❌ Manage global platform configuration
- ❌ Remove users platform-wide
- ❌ Assign `platform_admin` role

**Use Case**: Company/workspace owners or managers who need to manage their team and projects.

---

### 3. ML Engineer (`ml_engineer`)
**Machine Learning specialist focused on model development**

**What they can do:**
- ✅ **Dataset Management**: Upload, annotate, manage, and delete datasets
- ✅ **Model Training**: Start training jobs with custom configurations
- ✅ **Hyperparameter Tuning**: Adjust training parameters (epochs, batch size, learning rate, etc.)
- ✅ **View Training Metrics**: Access training metrics, loss curves, mAP trends, confusion matrices
- ✅ **Inference Operations**: Run inference jobs, monitor execution, and view results
- ✅ **View Access**: View projects, datasets, models, and inference results

**Cannot do:**
- ❌ Manage workspace settings
- ❌ Create/delete projects
- ❌ Manage workspace users
- ❌ Assign roles
- ❌ Delete projects

**Use Case**: Data scientists and ML engineers who focus on dataset preparation, model training, and optimization.

---

### 4. Operator (`operator`)
**Inference and monitoring specialist**

**What they can do:**
- ✅ **Run Inference**: Execute inference jobs on trained models
- ✅ **Monitor Inference**: Track inference job status and progress
- ✅ **View Inference Results**: Access and analyze inference outputs
- ✅ **View Access**: View projects, datasets, models, and training metrics (read-only)

**Cannot do:**
- ❌ Manage datasets
- ❌ Start training jobs
- ❌ Tune hyperparameters
- ❌ Create/delete projects
- ❌ Manage users or assign roles

**Use Case**: Production operators who deploy models and run inference in production environments.

---

### 5. Viewer (`viewer`)
**Read-only access for stakeholders**

**What they can do:**
- ✅ **View Projects**: Browse and view project details
- ✅ **View Datasets**: See dataset information and statistics
- ✅ **View Models**: Access trained model information and metrics
- ✅ **View Inference**: See inference results and history

**Cannot do:**
- ❌ Any write operations (create, update, delete)
- ❌ Run training or inference
- ❌ Manage datasets
- ❌ Access any management features

**Use Case**: Stakeholders, executives, or auditors who need visibility into projects and results without modification capabilities.

---

## 📊 Permission Matrix

| Permission | Platform Admin | Workspace Admin | ML Engineer | Operator | Viewer |
|-----------|:-------------:|:--------------:|:-----------:|:--------:|:------:|
| **Platform Management** |
| `manageGlobalConfig` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `removeUsers` (platform-wide) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Workspace Management** |
| `manageWorkspace` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `manageProjects` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `manageWorkspaceUsers` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `assignRoles` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `deleteProjects` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **ML Operations** |
| `manageDatasets` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `startTraining` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `tuneHyperparameters` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `viewTrainingMetrics` | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Inference Operations** |
| `runInference` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `monitorInference` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `viewInferenceResults` | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View Access** |
| `viewProjects` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `viewDatasets` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `viewModels` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `viewInference` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🔧 Backend Implementation Instructions

### Prerequisites
- Supabase migration `20251210000000_update_role_constraint_to_five_roles.sql` has been applied
- Database now supports roles: `platform_admin`, `workspace_admin`, `ml_engineer`, `operator`, `viewer`

---

### 1. API Endpoint: Update User Role

**Endpoint:** `PUT /api/users/:userId/role`

**Request:**
```typescript
PUT /api/users/:userId/role
Headers:
  Authorization: Bearer <supabase_session_token>
  Content-Type: application/json

Body:
{
  "role": "platform_admin" | "workspace_admin" | "ml_engineer" | "operator" | "viewer"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "User role updated successfully",
  "userId": "uuid",
  "newRole": "ml_engineer"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Permission denied" | "Invalid role" | "User not found" | "Cannot change own role"
}
```

**Authorization Rules:**
- ✅ Only `platform_admin` or `workspace_admin` can call this endpoint
- ✅ `platform_admin` can assign any role (including `platform_admin`)
- ✅ `workspace_admin` can assign: `workspace_admin`, `ml_engineer`, `operator`, `viewer`
- ❌ `workspace_admin` **cannot** assign `platform_admin`
- ❌ Users cannot change their own role (prevent self-demotion/promotion)

**Implementation Steps:**

1. **Extract user role from JWT token:**
   ```typescript
   // From Supabase session token, get user's profile.role
   const currentUserRole = await getUserRoleFromToken(token);
   ```

2. **Check permission:**
   ```typescript
   if (currentUserRole !== 'platform_admin' && currentUserRole !== 'workspace_admin') {
     return res.status(403).json({ error: 'Permission denied' });
   }
   ```

3. **Validate role assignment:**
   ```typescript
   // workspace_admin cannot assign platform_admin
   if (currentUserRole === 'workspace_admin' && newRole === 'platform_admin') {
     return res.status(403).json({ error: 'Cannot assign platform_admin role' });
   }
   
   // Prevent self-role change
   if (currentUserId === targetUserId) {
     return res.status(400).json({ error: 'Cannot change own role' });
   }
   ```

4. **Validate role value:**
   ```typescript
   const validRoles = ['platform_admin', 'workspace_admin', 'ml_engineer', 'operator', 'viewer'];
   if (!validRoles.includes(newRole)) {
     return res.status(400).json({ error: 'Invalid role' });
   }
   ```

5. **Update in Supabase:**
   ```typescript
   const { error } = await supabase
     .from('profiles')
     .update({ role: newRole })
     .eq('id', userId);
   
   if (error) {
     return res.status(500).json({ error: 'Failed to update role' });
   }
   ```

---

### 2. Middleware: Role-Based Authorization

Create middleware to check permissions on protected routes:

**Example Middleware:**
```typescript
// middleware/requirePermission.ts
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userRole = await getUserRoleFromToken(token);
    
    if (!userRole) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const hasPermission = checkPermission(userRole, permission);
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    next();
  };
};
```

**Permission Check Function:**
```typescript
// utils/permissions.ts
export const checkPermission = (role: string, permission: string): boolean => {
  const rolePermissions: Record<string, string[]> = {
    platform_admin: [
      'manageGlobalConfig', 'removeUsers', 'manageWorkspace', 'manageProjects',
      'manageWorkspaceUsers', 'assignRoles', 'deleteProjects', 'manageDatasets',
      'startTraining', 'tuneHyperparameters', 'viewTrainingMetrics',
      'runInference', 'monitorInference', 'viewInferenceResults',
      'viewProjects', 'viewDatasets', 'viewModels', 'viewInference'
    ],
    workspace_admin: [
      'manageWorkspace', 'manageProjects', 'manageWorkspaceUsers', 'assignRoles',
      'deleteProjects', 'manageDatasets', 'startTraining', 'tuneHyperparameters',
      'viewTrainingMetrics', 'runInference', 'monitorInference',
      'viewInferenceResults', 'viewProjects', 'viewDatasets', 'viewModels', 'viewInference'
    ],
    ml_engineer: [
      'manageDatasets', 'startTraining', 'tuneHyperparameters', 'viewTrainingMetrics',
      'runInference', 'monitorInference', 'viewInferenceResults',
      'viewProjects', 'viewDatasets', 'viewModels', 'viewInference'
    ],
    operator: [
      'runInference', 'monitorInference', 'viewInferenceResults',
      'viewProjects', 'viewDatasets', 'viewModels', 'viewInference'
    ],
    viewer: [
      'viewProjects', 'viewDatasets', 'viewModels', 'viewInference'
    ]
  };
  
  return rolePermissions[role]?.includes(permission) || false;
};
```

---

### 3. Protected Route Examples

**Example 1: Delete Project (requires `deleteProjects`)**
```typescript
router.delete('/projects/:projectId', 
  requirePermission('deleteProjects'),
  async (req, res) => {
    // Only platform_admin and workspace_admin can reach here
    // Delete project and linked artifacts
  }
);
```

**Example 2: Start Training (requires `startTraining`)**
```typescript
router.post('/train/start',
  requirePermission('startTraining'),
  async (req, res) => {
    // platform_admin, workspace_admin, ml_engineer can reach here
    // Start training job
  }
);
```

**Example 3: Run Inference (requires `runInference`)**
```typescript
router.post('/inference/run',
  requirePermission('runInference'),
  async (req, res) => {
    // platform_admin, workspace_admin, ml_engineer, operator can reach here
    // Execute inference
  }
);
```

**Example 4: View Projects (requires `viewProjects`)**
```typescript
router.get('/projects',
  requirePermission('viewProjects'),
  async (req, res) => {
    // All roles can reach here
    // Return projects based on workspace/company scope
  }
);
```

---

### 4. Database Queries: Scope by Role

**Workspace Scope:**
- `platform_admin`: Can access all workspaces
- `workspace_admin`: Can access only their workspace
- `ml_engineer`, `operator`, `viewer`: Can access only their workspace

**Example Query:**
```typescript
// Get user's workspace from profile
const userProfile = await supabase
  .from('profiles')
  .select('company_id, role')
  .eq('id', userId)
  .single();

// Build query based on role
let query = supabase.from('projects').select('*');

if (userProfile.role !== 'platform_admin') {
  // Scope to user's workspace
  query = query.eq('company_id', userProfile.company_id);
}

const { data: projects } = await query;
```

---

### 5. Supabase RLS (Row Level Security) Policies

Update RLS policies to respect roles:

**Example: Projects Table**
```sql
-- Platform admin can see all projects
CREATE POLICY "platform_admin_all_projects"
ON projects FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'platform_admin'
  )
);

-- Workspace admin can see their workspace projects
CREATE POLICY "workspace_admin_own_projects"
ON projects FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.company_id = projects.company_id
    AND profiles.role IN ('workspace_admin', 'ml_engineer', 'operator', 'viewer')
  )
);

-- Only platform_admin and workspace_admin can delete
CREATE POLICY "admins_can_delete_projects"
ON projects FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('platform_admin', 'workspace_admin')
  )
);
```

---

### 6. Error Handling

**Standard Error Responses:**
```typescript
// 401 Unauthorized - No token or invalid token
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}

// 403 Forbidden - Valid token but insufficient permissions
{
  "error": "Permission denied",
  "message": "Your role does not have permission to perform this action",
  "requiredPermission": "deleteProjects",
  "userRole": "ml_engineer"
}

// 400 Bad Request - Invalid input
{
  "error": "Invalid role",
  "message": "Role must be one of: platform_admin, workspace_admin, ml_engineer, operator, viewer"
}
```

---

### 7. Testing Checklist

**Role Assignment Endpoint:**
- [ ] `platform_admin` can assign all roles (including `platform_admin`)
- [ ] `workspace_admin` can assign: `workspace_admin`, `ml_engineer`, `operator`, `viewer`
- [ ] `workspace_admin` cannot assign `platform_admin`
- [ ] `ml_engineer`, `operator`, `viewer` cannot assign any roles
- [ ] Users cannot change their own role
- [ ] Invalid role values are rejected
- [ ] Non-existent user IDs return 404

**Protected Routes:**
- [ ] Each route respects role permissions
- [ ] `platform_admin` can access all routes
- [ ] `workspace_admin` can access appropriate routes
- [ ] `ml_engineer` can access ML-related routes
- [ ] `operator` can only access inference routes
- [ ] `viewer` can only access read-only routes

**Database Scope:**
- [ ] `platform_admin` sees all data
- [ ] Other roles see only their workspace data
- [ ] RLS policies enforce workspace boundaries

---

### 8. Migration Notes

**Existing Users:**
- After migration, existing `'admin'` roles → `'workspace_admin'`
- Existing `'member'` roles → `'viewer'`
- First user in system should be manually set to `'platform_admin'`

**Backward Compatibility:**
- Frontend handles both old (`'admin'`, `'member'`) and new roles
- Backend should validate against new 5-role system only
- Legacy role values should be rejected

---

## 📝 Summary

**Frontend Status:**
- ✅ Role types defined
- ✅ Permission system implemented
- ✅ UI component for role assignment created
- ✅ API integration ready

**Backend Required:**
- ⚠️ Implement `PUT /api/users/:userId/role` endpoint
- ⚠️ Add role-based authorization middleware
- ⚠️ Update protected routes with permission checks
- ⚠️ Update Supabase RLS policies
- ⚠️ Implement workspace scoping logic
- ⚠️ Add role validation and error handling

**Database Status:**
- ✅ Migration created for 5-role system
- ⚠️ Migration needs to be applied

---

## 🔗 Related Files

- Frontend Role Types: `src/types/roles.ts`
- Frontend Permissions: `src/lib/utils/permissions.ts`
- Frontend API: `src/lib/api/users.ts`
- UI Component: `src/components/CompanyMembers.tsx`
- Database Migration: `supabase/migrations/20251210000000_update_role_constraint_to_five_roles.sql`
