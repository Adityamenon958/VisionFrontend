# Phase 2 Plan: Annotation State Management & Mock API Integration

## Objective
Make Phase 1 annotation UI interactive and stateful using in-memory state management and mock APIs that match future backend contracts.

---

## Task 1: Annotation State Management Hook

### File: `src/hooks/useAnnotation.ts`

### State Interface
```typescript
interface AnnotationSessionState {
  images: Image[];
  currentImageIndex: number;
  annotations: Annotation[]; // Filtered for current image
  selectedCategoryId: string | null;
  isDrawing: boolean;
  unsavedChanges: boolean;
  history: Annotation[][]; // For undo/redo
  historyIndex: number;
}
```

### Hook API
```typescript
const {
  // State
  images,
  currentImage,
  currentImageIndex,
  annotations,
  selectedCategoryId,
  isDrawing,
  unsavedChanges,
  canUndo,
  canRedo,
  
  // Actions
  loadImages,
  selectImage,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  setCategory,
  setDrawing,
  undo,
  redo,
  markSaved,
  reset,
} = useAnnotation();
```

### Implementation Details
- **In-memory state**: Use `useState` hooks
- **History management**: Array of annotation snapshots, max 50 steps
- **Current image filtering**: `annotations.filter(a => a.imageId === currentImage.id)`
- **Undo/Redo**: Push state to history array, navigate with index

---

## Task 2: Mock API Layer

### Folder Structure
```
src/lib/api/mock/
├── annotations.mock.ts
├── categories.mock.ts
└── datasets.mock.ts
```

### 2.1 annotations.mock.ts

**In-memory storage:**
```typescript
// Module-level storage
const mockAnnotations: Record<string, Annotation[]> = {};
const mockImages: Record<string, Image[]> = {};
```

**Functions (all return Promise, simulate 200-500ms delay):**

1. **getUnlabeledImages(datasetId: string)**
   - Returns: `Promise<{ images: Image[], total: number, page: number, limit: number, totalPages: number }>`
   - Mock: Return 10-20 mock images from `annotationMocks.ts`

2. **getAnnotations(datasetId: string, imageId?: string)**
   - Returns: `Promise<{ annotations: Annotation[], total: number }>`
   - Mock: Return annotations from in-memory storage

3. **saveAnnotation(datasetId: string, annotation: { imageId, bbox, categoryId })**
   - Returns: `Promise<{ annotation: Annotation, message: string }>`
   - Mock: Generate ID, store in memory, return saved annotation

4. **updateAnnotation(datasetId: string, annotationId: string, data: Partial<Annotation>)**
   - Returns: `Promise<{ annotation: Annotation, message: string }>`
   - Mock: Update in-memory storage

5. **deleteAnnotation(datasetId: string, annotationId: string)**
   - Returns: `Promise<{ message: string, annotationId: string }>`
   - Mock: Remove from in-memory storage

6. **batchSaveAnnotations(datasetId: string, annotations: Array<...>)**
   - Returns: `Promise<{ saved: number, failed: number, errors?: Array<...> }>`
   - Mock: Save all, return success count

### 2.2 categories.mock.ts

**Functions:**

1. **getCategories(datasetId: string)**
   - Returns: `Promise<{ categories: Category[] }>`
   - Mock: Return default categories from `annotationMocks.ts` (Defect, Good, Unknown)

### 2.3 datasets.mock.ts

**Functions:**

1. **convertAnnotationsToLabels(datasetId: string, options?: { imageIds?: string[] })**
   - Returns: `Promise<{ converted: number, labelFilesCreated: number, message: string }>`
   - Mock: Return success response with mock counts (no actual conversion)

---

## Task 3: Wire UI to State + Mock APIs

### 3.1 AnnotationWorkspace.tsx Updates

**On Mount:**
```typescript
useEffect(() => {
  // 1. Fetch unlabeled images via mock API
  annotationsMock.getUnlabeledImages(datasetId)
    .then(data => {
      annotationState.loadImages(data.images);
      if (data.images.length > 0) {
        annotationState.selectImage(0);
      }
    });
  
  // 2. Load categories
  categoriesMock.getCategories(datasetId)
    .then(data => {
      // Store in component state or pass to CategorySelector
    });
}, [datasetId]);
```

**On Image Change:**
```typescript
useEffect(() => {
  if (currentImage) {
    // Fetch annotations for current image
    annotationsMock.getAnnotations(datasetId, currentImage.id)
      .then(data => {
        // Update annotation state with fetched annotations
        annotationState.loadAnnotations(data.annotations);
      });
  }
}, [currentImage?.id]);
```

**Component Props Wiring:**
- `ImageViewer`: `imageUrl={currentImage?.url}`, `imageId={currentImage?.id}`
- `ImageThumbnailGrid`: `images={images}`, `currentImageId={currentImage?.id}`, `onImageSelect={(id) => handleImageSelect(id)}`
- `BoundingBoxCanvas`: `annotations={annotations}`, `imageWidth={...}`, `imageHeight={...}`
- `CategorySelector`: `categories={categories}`, `selectedCategoryId={selectedCategoryId}`, `onCategorySelect={setCategory}`
- `AnnotationToolbar`: `onDelete={handleDelete}`, `onUndo={undo}`, `onRedo={redo}`, `canUndo={canUndo}`, `canRedo={canRedo}`
- `AnnotationProgress`: `current={currentImageIndex + 1}`, `total={images.length}`, `annotated={countAnnotatedImages()}`

---

## Task 4: Auto-Save Simulation

### Implementation in AnnotationWorkspace.tsx

**Debounced Save:**
```typescript
const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const triggerAutoSave = useCallback(() => {
  // Clear existing timeout
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }
  
  // Set unsavedChanges flag
  annotationState.setUnsavedChanges(true);
  
  // Debounce save (2 seconds)
  saveTimeoutRef.current = setTimeout(() => {
    const annotationsToSave = annotations.filter(a => !a.id || a.updated);
    
    if (annotationsToSave.length > 0) {
      // Show "Saving..." feedback
      setSaveStatus("saving");
      
      // Call mock batch save API
      annotationsMock.batchSaveAnnotations(datasetId, annotationsToSave)
        .then(() => {
          annotationState.markSaved();
          setSaveStatus("saved");
          // Clear "Saved" message after 2 seconds
          setTimeout(() => setSaveStatus("idle"), 2000);
        })
        .catch(() => {
          setSaveStatus("error");
        });
    }
  }, 2000);
}, [annotations, datasetId]);
```

**Trigger Points:**
- After `addAnnotation()`
- After `updateAnnotation()`
- After `deleteAnnotation()`

**UI Feedback:**
- Add status indicator: "Saving...", "Saved", or "Error"
- Show in AnnotationWorkspace header or toolbar

---

## Task 5: Image Navigation Rules

### Implementation in AnnotationWorkspace.tsx

**Navigation Handler:**
```typescript
const handleImageSelect = useCallback((targetIndex: number) => {
  if (unsavedChanges) {
    // Show confirmation dialog
    const confirmed = window.confirm(
      "You have unsaved changes. Navigate away anyway?"
    );
    if (!confirmed) return;
  }
  
  // Save current state to history before navigation
  annotationState.saveToHistory();
  
  // Navigate to new image
  annotationState.selectImage(targetIndex);
  
  // Reset unsavedChanges (new image = fresh state)
  annotationState.markSaved();
}, [unsavedChanges]);
```

**Navigation Methods:**
- **Previous**: `handleImageSelect(currentImageIndex - 1)`
- **Next**: `handleImageSelect(currentImageIndex + 1)`
- **Thumbnail click**: `handleImageSelect(clickedIndex)`
- **Keyboard shortcuts** (optional for Phase 2): Arrow keys, Space

**Boundary Checks:**
- Disable "Previous" when `currentImageIndex === 0`
- Disable "Next" when `currentImageIndex === images.length - 1`

---

## File Structure

```
src/
├── hooks/
│   └── useAnnotation.ts          # NEW: State management hook
├── lib/
│   ├── api/
│   │   └── mock/                  # NEW: Mock API folder
│   │       ├── annotations.mock.ts
│   │       ├── categories.mock.ts
│   │       └── datasets.mock.ts
│   └── mocks/
│       └── annotationMocks.ts      # EXISTS: Use for mock data
└── components/
    └── annotation/
        └── AnnotationWorkspace.tsx # MODIFY: Wire to state + APIs
```

---

## Implementation Checklist

### State Management
- [ ] Create `useAnnotation.ts` hook
- [ ] Implement state interface
- [ ] Implement all action functions
- [ ] Implement undo/redo history
- [ ] Test state updates

### Mock APIs
- [ ] Create `annotations.mock.ts` with all 6 functions
- [ ] Create `categories.mock.ts` with getCategories
- [ ] Create `datasets.mock.ts` with convertAnnotationsToLabels
- [ ] Add setTimeout delays (200-500ms)
- [ ] Use in-memory storage
- [ ] Match exact API contracts from plan

### UI Wiring
- [ ] Update AnnotationWorkspace to use `useAnnotation` hook
- [ ] Fetch images on mount
- [ ] Fetch annotations on image change
- [ ] Wire ImageViewer props
- [ ] Wire ImageThumbnailGrid props
- [ ] Wire BoundingBoxCanvas props (read-only rendering)
- [ ] Wire CategorySelector props
- [ ] Wire AnnotationToolbar props
- [ ] Wire AnnotationProgress props

### Auto-Save
- [ ] Implement debounced save function
- [ ] Trigger on annotation changes
- [ ] Show save status feedback
- [ ] Handle save errors

### Navigation
- [ ] Implement image selection handler
- [ ] Add unsaved changes confirmation
- [ ] Add prev/next navigation
- [ ] Add boundary checks
- [ ] Update thumbnail selection

---

## Success Criteria

✅ Annotation state persists during session
✅ Images load from mock API
✅ Annotations load per image
✅ Undo/redo works
✅ Auto-save triggers after 2 seconds
✅ Save status shows feedback
✅ Image navigation works
✅ Unsaved changes warning appears
✅ No real HTTP requests made
✅ All mock APIs match backend contracts
✅ UI is fully interactive

---

## Constraints (Strict)

❌ NO real backend calls (fetch, axios, Supabase)
❌ NO category CRUD (read-only)
❌ NO YOLO conversion logic (mock response only)
❌ NO Context/Zustand (use hook only)
❌ NO bounding box drawing logic (Phase 3)
❌ NO multi-user logic
❌ NO persistence across page reloads

---

## Next Steps (Phase 3)

After Phase 2 completion:
- Add bounding box drawing on canvas
- Implement category CRUD
- Add keyboard shortcuts
- Polish UI/UX
- Add annotation statistics

---

**Estimated Time**: 4-6 hours
**Complexity**: Medium (state management + API abstraction)
**Dependencies**: Phase 1 complete

