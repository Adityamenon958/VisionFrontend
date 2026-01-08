# Phase 5 Plan: Backend Integration & Production Enablement

## Objective
Integrate the annotation system with real backend APIs to enable persistence, YOLO conversion, and model downloads while maintaining all Phase 1-4 improvements.

---

## Task 1: Replace Mock APIs with Real API Layer

### 1.1 Create Real API Service Files

**File: `src/lib/api/annotations.ts`**

**Functions to implement:**
```typescript
// Get unlabeled images
export const getUnlabeledImages = async (
  datasetId: string,
  params?: { page?: number; limit?: number }
): Promise<{
  images: Image[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}>;

// Get annotations
export const getAnnotations = async (
  datasetId: string,
  imageId?: string
): Promise<{
  annotations: Annotation[];
  total: number;
}>;

// Save annotation
export const saveAnnotation = async (
  datasetId: string,
  annotation: {
    imageId: string;
    bbox: [number, number, number, number];
    categoryId: string;
  }
): Promise<{
  annotation: Annotation;
  message: string;
}>;

// Update annotation
export const updateAnnotation = async (
  datasetId: string,
  annotationId: string,
  data: {
    bbox?: [number, number, number, number];
    categoryId?: string;
  }
): Promise<{
  annotation: Annotation;
  message: string;
}>;

// Delete annotation
export const deleteAnnotation = async (
  datasetId: string,
  annotationId: string
): Promise<{
  message: string;
  annotationId: string;
}>;

// Batch save annotations
export const batchSaveAnnotations = async (
  datasetId: string,
  annotations: Array<{
    imageId: string;
    bbox: [number, number, number, number];
    categoryId: string;
  }>
): Promise<{
  saved: number;
  failed: number;
  errors?: Array<{ imageId: string; error: string }>;
}>;
```

**Implementation details:**
- Use `fetch` with proper error handling
- Attach auth headers from Supabase session
- Handle network errors, timeouts, and 4xx/5xx responses
- Return typed responses matching backend contracts
- Add request retry logic for transient failures

**File: `src/lib/api/categories.ts`**

**Functions to implement:**
```typescript
// Get categories
export const getCategories = async (
  datasetId: string
): Promise<{
  categories: Category[];
}>;

// Create category
export const createCategory = async (
  datasetId: string,
  data: {
    name: string;
    color: string;
    description?: string;
  }
): Promise<{
  category: Category;
}>;

// Update category
export const updateCategory = async (
  datasetId: string,
  categoryId: string,
  data: {
    name?: string;
    color?: string;
    description?: string;
  }
): Promise<{
  category: Category;
  message: string;
}>;

// Delete category
export const deleteCategory = async (
  datasetId: string,
  categoryId: string,
  reassignTo?: string
): Promise<{
  message: string;
  reassignedCount?: number;
}>;

// Reorder categories
export const reorderCategories = async (
  datasetId: string,
  categoryIds: string[]
): Promise<{
  message: string;
}>;
```

**File: `src/lib/api/models.ts`**

**Functions to implement:**
```typescript
// Convert annotations to YOLO labels
export const convertAnnotationsToLabels = async (
  datasetId: string,
  options?: {
    imageIds?: string[];
    folder?: string;
  }
): Promise<{
  converted: number;
  labelFilesCreated: number;
  message: string;
}>;

// Get model download URL
export const getModelDownloadUrl = async (
  modelId: string,
  format: "pt" | "onnx" | "zip"
): Promise<{
  downloadUrl: string;
  expiresAt: string;
  fileSize: number;
}>;

// Get model info
export const getModelInfo = async (
  modelId: string
): Promise<{
  id: string;
  name: string;
  format: string;
  size: number;
  createdAt: string;
  availableFormats: string[];
}>;
```

### 1.2 API Configuration & Utilities

**File: `src/lib/api/config.ts` (NEW)**
```typescript
// API base URL configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Get auth headers
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  return headers;
};

// Handle API errors
export const handleApiError = (error: unknown): never => {
  if (error instanceof Error) {
    throw new Error(error.message);
  }
  throw new Error('An unknown error occurred');
};

// Retry logic for transient failures
export const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  // Implementation with exponential backoff
};
```

### 1.3 Replace Mock Imports

**Files to update:**
- `src/components/annotation/AnnotationWorkspace.tsx`
  - Replace `import * as annotationsMock` → `import * as annotationsApi`
  - Replace `import * as categoriesMock` → `import * as categoriesApi`
- `src/lib/api/mock/` folder
  - Keep for reference but mark as deprecated
  - Add `@deprecated` comments

**Migration strategy:**
1. Create real API files alongside mocks
2. Add feature flag: `USE_REAL_API` (default: true)
3. Update imports conditionally
4. Test with real backend
5. Remove mocks after verification

---

## Task 2: Annotation Persistence

### 2.1 Update AnnotationWorkspace

**File: `src/components/annotation/AnnotationWorkspace.tsx`**

**Changes:**
- Replace mock API calls with real API calls
- Add error handling for each operation:
  - Create annotation → show toast on error, retry option
  - Update annotation → handle conflicts, show error
  - Delete annotation → confirm, handle errors
  - Batch save → show progress, handle partial failures

**Error handling pattern:**
```typescript
try {
  await annotationsApi.saveAnnotation(datasetId, annotation);
  // Success
} catch (error) {
  toast({
    title: "Failed to save annotation",
    description: error.message,
    variant: "destructive",
    action: <Button onClick={retry}>Retry</Button>
  });
}
```

### 2.2 Auto-Save Flow

**Update auto-save logic:**
- Use real `batchSaveAnnotations` API
- Handle partial failures (some annotations saved, some failed)
- Show detailed error messages
- Retry failed annotations automatically
- Update UI to reflect saved state

**Implementation:**
```typescript
const triggerAutoSave = useCallback(async () => {
  // ... existing debounce logic ...
  
  try {
    const result = await annotationsApi.batchSaveAnnotations(
      datasetId,
      annotationsToSave
    );
    
    if (result.failed > 0) {
      // Handle partial failure
      toast({
        title: "Some annotations failed to save",
        description: `${result.saved} saved, ${result.failed} failed`,
        variant: "destructive"
      });
    } else {
      markSaved();
      setSaveStatus("saved");
    }
  } catch (error) {
    // Handle complete failure
    setSaveStatus("error");
  }
}, [annotations, datasetId]);
```

### 2.3 Annotation Reloading

**On image change:**
- Already implemented, ensure it uses real API
- Handle loading states
- Handle empty states (no annotations)

**On workspace reopen:**
- Fetch all annotations for dataset on mount
- Cache annotations per image
- Update UI when annotations load

**Implementation:**
```typescript
// Fetch annotations on mount
useEffect(() => {
  const fetchAllAnnotations = async () => {
    try {
      const data = await annotationsApi.getAnnotations(datasetId);
      // Load into state
      loadAllAnnotations(data.annotations);
    } catch (error) {
      toast({
        title: "Failed to load annotations",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  fetchAllAnnotations();
}, [datasetId]);
```

---

## Task 3: Category Persistence

### 3.1 Update CategoryManager

**File: `src/components/annotation/CategoryManager.tsx`**

**Changes:**
- Replace mock API calls with real API calls
- Add error handling for each CRUD operation
- Show loading states during operations
- Handle validation errors from backend

**Error handling:**
```typescript
const handleCategoryCreate = async (category: Omit<Category, "id">) => {
  try {
    setCreating(true);
    const result = await categoriesApi.createCategory(datasetId, category);
    setCategories(prev => [...prev, result.category]);
    toast({ title: "Category created" });
  } catch (error) {
    toast({
      title: "Failed to create category",
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setCreating(false);
  }
};
```

### 3.2 Category Reloading

**On workspace mount:**
- Fetch categories from backend
- Ensure default categories exist (backend should handle this)
- Update UI when categories load

**On category update:**
- Update local state immediately (optimistic update)
- Sync with backend
- Rollback on error

**Category propagation:**
- When category name/color changes, update all annotations with that category
- Use batch update API if available
- Show progress for bulk updates

---

## Task 4: Convert Annotations to YOLO Labels

### 4.1 Create Conversion Component

**File: `src/components/annotation/ConvertToYOLOButton.tsx` (NEW)**

**Props:**
```typescript
interface ConvertToYOLOButtonProps {
  datasetId: string;
  imageIds?: string[];
  onConversionComplete?: (result: ConversionResult) => void;
}
```

**Implementation:**
- Show button: "Convert Annotations to YOLO Labels"
- On click: Show confirmation dialog
- Call API: `POST /api/dataset/:datasetId/convert-annotations-to-labels`
- Show progress indicator
- Handle success/error states
- Display conversion results (counts, file locations)

**UI Flow:**
1. User clicks "Convert to YOLO"
2. Confirmation dialog: "Convert all annotations to YOLO format?"
3. Show loading state: "Converting annotations..."
4. On success: "Converted X annotations to Y labels"
5. On error: Show error message with retry option

### 4.2 Integration Points

**Option 1: Standalone button in AnnotationWorkspace**
- Add to toolbar or header
- Accessible after annotations are created

**Option 2: Before training starts**
- In SimulationView, before training
- Auto-convert if annotations exist
- Show progress in training flow

**Option 3: Both**
- Standalone button for manual conversion
- Auto-convert before training

**Recommended: Option 3**

### 4.3 YOLO Format Validation

**Ensure format correctness:**
- Backend should validate format
- Frontend should show validation errors
- Format: `class_id center_x center_y width height` (normalized 0-1)

**Error handling:**
- Invalid annotations → show which ones failed
- Missing categories → prompt to create categories
- Empty annotations → show warning

---

## Task 5: Model Weight Downloads

### 5.1 Create ModelDownloadButton Component

**File: `src/components/training/ModelDownloadButton.tsx` (NEW)**

**Props:**
```typescript
interface ModelDownloadButtonProps {
  modelId: string;
  modelName: string;
  availableFormats?: ("pt" | "onnx" | "zip")[];
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  onDownloadError?: (error: Error) => void;
}
```

**Features:**
- Dropdown/button group for format selection
- Show file size for each format
- Download progress indicator
- Handle signed URL expiration
- Retry on failure
- Show download success/error states

**Implementation:**
```typescript
const handleDownload = async (format: "pt" | "onnx" | "zip") => {
  try {
    setDownloading(true);
    setDownloadProgress(0);
    
    // Get signed URL
    const { downloadUrl, fileSize } = await modelsApi.getModelDownloadUrl(
      modelId,
      format
    );
    
    // Download file
    const response = await fetch(downloadUrl);
    const blob = await response.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modelName}.${format}`;
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    setDownloading(false);
    setDownloadProgress(100);
  } catch (error) {
    // Handle error
  }
};
```

### 5.2 Integration Points

**Training completion screen:**
- Show download button after training completes
- Display model info (size, format, created date)
- Multiple format options

**Trained models list:**
- Add download button to each model row
- Show available formats
- Quick download action

**Model details panel:**
- Full download section
- Format selection
- Download history (optional)

### 5.3 Download Progress & States

**Progress indicator:**
- Use `fetch` with progress tracking (if supported)
- Or show indeterminate progress
- Display file size and downloaded size

**States:**
- Idle: "Download .pt"
- Loading: "Downloading... (2.5 MB / 10 MB)"
- Success: "Downloaded successfully"
- Error: "Download failed - Retry"

---

## Task 6: Security & Robustness

### 6.1 Auth Headers

**Ensure all API calls include auth:**
- Use `getAuthHeaders()` utility
- Refresh token if expired
- Handle 401 errors (redirect to login)

**Implementation:**
```typescript
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const headers = await getAuthHeaders();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  
  if (response.status === 401) {
    // Handle unauthorized
    await supabase.auth.signOut();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  
  return response;
};
```

### 6.2 Signed URL Handling

**For model downloads:**
- Check URL expiration before download
- Refresh URL if expired
- Handle 403/404 errors gracefully

**Implementation:**
```typescript
const downloadWithRetry = async (modelId: string, format: string) => {
  try {
    const { downloadUrl } = await modelsApi.getModelDownloadUrl(modelId, format);
    await downloadFile(downloadUrl);
  } catch (error) {
    if (error.message.includes('expired') || error.message.includes('403')) {
      // Retry with fresh URL
      const { downloadUrl } = await modelsApi.getModelDownloadUrl(modelId, format);
      await downloadFile(downloadUrl);
    } else {
      throw error;
    }
  }
};
```

### 6.3 Response Validation

**Validate all backend responses:**
- Use Zod schemas for validation
- Handle unexpected response shapes
- Log validation errors for debugging

**File: `src/lib/api/schemas.ts` (NEW)**
```typescript
import { z } from 'zod';

export const AnnotationResponseSchema = z.object({
  annotation: z.object({
    id: z.string(),
    imageId: z.string(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    categoryId: z.string(),
    categoryName: z.string(),
  }),
  message: z.string(),
});

// Use in API functions
const validateResponse = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  return schema.parse(data);
};
```

### 6.4 Error Recovery

**Network errors:**
- Retry with exponential backoff
- Show user-friendly error messages
- Provide retry buttons

**Backend errors:**
- Handle 4xx errors (validation, not found)
- Handle 5xx errors (server errors)
- Show appropriate error messages

**Partial failures:**
- Handle batch operations with partial success
- Show which items succeeded/failed
- Allow retry of failed items only

---

## File Structure

```
src/
├── lib/
│   ├── api/
│   │   ├── annotations.ts          # NEW: Real annotation API
│   │   ├── categories.ts           # NEW: Real category API
│   │   ├── models.ts               # NEW: Model download API
│   │   ├── config.ts               # NEW: API configuration
│   │   ├── schemas.ts              # NEW: Response validation
│   │   └── mock/                   # DEPRECATED: Keep for reference
│   │       ├── annotations.mock.ts
│   │       ├── categories.mock.ts
│   │       └── datasets.mock.ts
├── components/
│   ├── annotation/
│   │   ├── AnnotationWorkspace.tsx # MODIFY: Use real APIs
│   │   └── ConvertToYOLOButton.tsx # NEW: YOLO conversion
│   └── training/
│       └── ModelDownloadButton.tsx # NEW: Model downloads
```

---

## Implementation Checklist

### API Layer
- [ ] Create `annotations.ts` with all functions
- [ ] Create `categories.ts` with all functions
- [ ] Create `models.ts` with download/conversion functions
- [ ] Create `config.ts` with auth and utilities
- [ ] Create `schemas.ts` for response validation
- [ ] Add error handling and retry logic
- [ ] Test all API endpoints

### Annotation Persistence
- [ ] Replace mock imports in AnnotationWorkspace
- [ ] Update create annotation flow
- [ ] Update update annotation flow
- [ ] Update delete annotation flow
- [ ] Update batch save flow
- [ ] Add error handling and retry
- [ ] Test annotation persistence

### Category Persistence
- [ ] Replace mock imports in CategoryManager
- [ ] Update create category flow
- [ ] Update update category flow
- [ ] Update delete category flow
- [ ] Update reorder categories flow
- [ ] Add error handling
- [ ] Test category persistence

### YOLO Conversion
- [ ] Create ConvertToYOLOButton component
- [ ] Integrate into AnnotationWorkspace
- [ ] Integrate into training flow
- [ ] Add progress indicators
- [ ] Add error handling
- [ ] Test conversion flow

### Model Downloads
- [ ] Create ModelDownloadButton component
- [ ] Integrate into training completion screen
- [ ] Integrate into models list
- [ ] Add download progress
- [ ] Handle signed URL expiration
- [ ] Test download flow

### Security & Robustness
- [ ] Add auth headers to all API calls
- [ ] Handle token refresh
- [ ] Validate all responses
- [ ] Add error recovery
- [ ] Test error scenarios

---

## Migration Strategy

### Phase 5.1: API Layer Creation
1. Create real API files alongside mocks
2. Add feature flag: `USE_REAL_API = true`
3. Test API functions independently
4. Verify request/response shapes

### Phase 5.2: Gradual Replacement
1. Replace annotation API calls first
2. Test annotation persistence
3. Replace category API calls
4. Test category persistence
5. Replace model API calls
6. Test model downloads

### Phase 5.3: Cleanup
1. Remove mock API imports
2. Remove feature flags
3. Update documentation
4. Remove deprecated mock files (optional, keep for reference)

---

## Testing Checklist

### Annotation API
- [ ] Get unlabeled images
- [ ] Get annotations
- [ ] Create annotation
- [ ] Update annotation
- [ ] Delete annotation
- [ ] Batch save annotations
- [ ] Error handling (network, 4xx, 5xx)

### Category API
- [ ] Get categories
- [ ] Create category
- [ ] Update category
- [ ] Delete category
- [ ] Reorder categories
- [ ] Error handling

### Model API
- [ ] Convert to YOLO
- [ ] Get download URL
- [ ] Download model file
- [ ] Handle expired URLs
- [ ] Error handling

### Integration
- [ ] Full annotation workflow
- [ ] Category management workflow
- [ ] Training with YOLO labels
- [ ] Model download workflow
- [ ] Error recovery scenarios

---

## Success Criteria

✅ All mock APIs replaced with real APIs
✅ Annotations persist across sessions
✅ Categories persist correctly
✅ YOLO conversion works end-to-end
✅ Model downloads work with progress
✅ All API calls include auth headers
✅ Error handling is robust
✅ No UX regressions from Phase 1-4
✅ Performance remains optimal

---

## Constraints (Strict)

❌ Do NOT change annotation UX behavior
❌ Do NOT remove performance optimizations
❌ Do NOT re-introduce mock APIs
❌ Do NOT add new features beyond integration
❌ Do NOT break existing functionality

---

## API Endpoints Reference

Based on `ANNOTATION_IMPLEMENTATION_PLAN.md`:

### Annotations
- `GET /api/dataset/:datasetId/unlabeled-images`
- `GET /api/dataset/:datasetId/annotations`
- `POST /api/dataset/:datasetId/annotations`
- `PUT /api/dataset/:datasetId/annotations/:annotationId`
- `DELETE /api/dataset/:datasetId/annotations/:annotationId`
- `POST /api/dataset/:datasetId/annotations/batch`

### Categories
- `GET /api/dataset/:datasetId/categories`
- `POST /api/dataset/:datasetId/categories`
- `PUT /api/dataset/:datasetId/categories/:categoryId`
- `DELETE /api/dataset/:datasetId/categories/:categoryId`
- `PUT /api/dataset/:datasetId/categories/reorder`

### Models
- `POST /api/dataset/:datasetId/convert-annotations-to-labels`
- `GET /api/models/:modelId/download-url`
- `GET /api/models/:modelId`

---

## Error Handling Patterns

### Network Errors
```typescript
try {
  await apiCall();
} catch (error) {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    // Network error
    toast({ title: "Network error", description: "Please check your connection" });
  } else {
    // Other error
    toast({ title: "Error", description: error.message });
  }
}
```

### Backend Errors
```typescript
const response = await fetch(url);
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || `HTTP ${response.status}`);
}
```

### Retry Logic
```typescript
const retry = async (fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
};
```

---

## Next Steps (Phase 6)

After Phase 5 completion:
- Advanced annotation features (multi-select, copy/paste)
- Annotation review workflow
- Collaborative annotation
- Annotation export/import
- Advanced statistics and analytics

---

**Estimated Time**: 8-12 hours
**Complexity**: High (API integration + error handling)
**Dependencies**: Backend APIs must be ready, Phase 1-4 complete




