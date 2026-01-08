# Detailed Implementation Plan: Annotation & Model Download Features

## Overview
This document outlines the implementation plan for four key features:
1. Manual annotation UI/UX in the training section for unlabeled data
2. Annotation persistence and backend integration
3. Defect category management during annotation
4. Trained model weight file downloads

---

## Phase 1: Manual Annotation UI/UX for Unlabeled Data

### 1.1 Current State Analysis
- **Location**: Training section is in `SimulationView.tsx` component
- **Current Flow**: Users select project → dataset → model → start training
- **Gap**: No annotation interface for unlabeled datasets before training
- **Dataset Info**: `datasetDetails` contains `unlabeledImages` count (line 1420 in SimulationView.tsx)

### 1.2 Design Requirements

#### 1.2.1 UI Components Needed
1. **Annotation Mode Toggle**
   - Add button/tab in SimulationView to switch between "Training" and "Annotation" modes
   - Location: After dataset selection, before model selection
   - Visual indicator when unlabeled images exist

2. **Annotation Workspace Component** (`AnnotationWorkspace.tsx`)
   - Full-screen or modal annotation interface
   - Image viewer with zoom/pan capabilities (reuse from DatasetManager)
   - Bounding box drawing tools
   - Category selector sidebar
   - Navigation controls (prev/next image, jump to image)
   - Progress indicator (X of Y images annotated)

3. **Image Navigation Panel**
   - Thumbnail grid of unlabeled images
   - Visual indicators: annotated (checkmark), in-progress (pencil), unannotated (empty)
   - Filter by annotation status
   - Search by filename

4. **Annotation Tools Panel**
   - Bounding box tool (rectangle selection)
   - Category assignment dropdown
   - Delete annotation button
   - Undo/Redo functionality
   - Keyboard shortcuts support

#### 1.2.2 User Flow
```
1. User selects project and dataset in SimulationView
2. System detects unlabeled images in dataset
3. "Annotate Unlabeled Data" button appears (if unlabeledImages > 0)
4. User clicks button → Opens AnnotationWorkspace
5. User annotates images:
   - Select image from thumbnail grid
   - Draw bounding boxes on image
   - Assign category to each bounding box
   - Save annotation (auto-save or manual)
   - Navigate to next image
6. After annotation session:
   - Return to SimulationView
   - Annotated images now available for training
   - Dataset status updates to reflect new labeled data
```

### 1.3 Technical Implementation

#### 1.3.1 New Components to Create
```
src/components/annotation/
├── AnnotationWorkspace.tsx          # Main annotation interface
├── ImageViewer.tsx                   # Image display with zoom/pan (can reuse from DatasetManager)
├── BoundingBoxCanvas.tsx            # Canvas overlay for drawing bounding boxes
├── CategorySelector.tsx              # Category management sidebar
├── AnnotationToolbar.tsx            # Tool buttons (draw, delete, undo, etc.)
├── ImageThumbnailGrid.tsx           # Thumbnail navigation panel
└── AnnotationProgress.tsx           # Progress indicator component
```

#### 1.3.2 State Management
```typescript
// Annotation state structure
interface AnnotationState {
  currentImageId: string | null;
  currentImageUrl: string | null;
  annotations: Array<{
    id: string;
    imageId: string;
    bbox: [number, number, number, number]; // [x, y, width, height] normalized 0-1
    categoryId: string;
    categoryName: string;
    confidence?: number; // For pre-annotations
  }>;
  categories: Array<{
    id: string;
    name: string;
    color: string; // For visualization
    description?: string;
  }>;
  annotationHistory: Array<AnnotationState>; // For undo/redo
  currentHistoryIndex: number;
  isDrawing: boolean;
  tempBbox: [number, number, number, number] | null;
  unsavedChanges: boolean;
}
```

#### 1.3.3 Integration Points in SimulationView
- **Location**: After dataset selection card (around line 1346)
- **Conditional Rendering**: Show annotation button only if `datasetDetails?.unlabeledImages > 0`
- **State**: Add `annotationMode` state to toggle between training and annotation views

---

## Phase 2: Annotation Persistence & Backend Integration

### 2.1 Backend API Endpoints Required

#### 2.1.1 Get Unlabeled Images
```
GET /api/dataset/:datasetId/unlabeled-images
Query Params:
  - page: number (default: 1)
  - limit: number (default: 50)
  - folder?: string (optional folder filter)

Response:
{
  images: Array<{
    id: string;
    filename: string;
    url: string;
    thumbnailUrl?: string;
    folder?: string;
    size?: number;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

#### 2.1.2 Get Existing Annotations
```
GET /api/dataset/:datasetId/annotations
Query Params:
  - imageId?: string (optional, get annotations for specific image)
  - categoryId?: string (optional filter)

Response:
{
  annotations: Array<{
    id: string;
    imageId: string;
    bbox: [number, number, number, number];
    categoryId: string;
    categoryName: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
  }>;
  total: number;
}
```

#### 2.1.3 Save Annotation
```
POST /api/dataset/:datasetId/annotations
Body:
{
  imageId: string;
  bbox: [number, number, number, number];
  categoryId: string;
}

Response:
{
  annotation: {
    id: string;
    imageId: string;
    bbox: [number, number, number, number];
    categoryId: string;
    categoryName: string;
    createdAt: string;
  };
  message: "Annotation saved successfully";
}
```

#### 2.1.4 Batch Save Annotations
```
POST /api/dataset/:datasetId/annotations/batch
Body:
{
  annotations: Array<{
    imageId: string;
    bbox: [number, number, number, number];
    categoryId: string;
  }>;
}

Response:
{
  saved: number;
  failed: number;
  errors?: Array<{ imageId: string; error: string }>;
}
```

#### 2.1.5 Update Annotation
```
PUT /api/dataset/:datasetId/annotations/:annotationId
Body:
{
  bbox?: [number, number, number, number];
  categoryId?: string;
}

Response:
{
  annotation: { ... };
  message: "Annotation updated";
}
```

#### 2.1.6 Delete Annotation
```
DELETE /api/dataset/:datasetId/annotations/:annotationId

Response:
{
  message: "Annotation deleted";
  annotationId: string;
}
```

#### 2.1.7 Convert Annotations to Labels
```
POST /api/dataset/:datasetId/convert-annotations-to-labels
Body:
{
  imageIds?: string[]; // Optional: specific images, or all if omitted
  folder?: string; // Optional: specific folder
}

Response:
{
  converted: number;
  labelFilesCreated: number;
  message: "Annotations converted to YOLO label format";
}
```

### 2.2 Frontend API Integration

#### 2.2.1 Create API Service File
```typescript
// src/lib/api/annotations.ts
export const annotationApi = {
  getUnlabeledImages: async (datasetId: string, params?: { page?: number; limit?: number }) => { ... },
  getAnnotations: async (datasetId: string, imageId?: string) => { ... },
  saveAnnotation: async (datasetId: string, annotation: AnnotationData) => { ... },
  batchSaveAnnotations: async (datasetId: string, annotations: AnnotationData[]) => { ... },
  updateAnnotation: async (datasetId: string, annotationId: string, updates: Partial<AnnotationData>) => { ... },
  deleteAnnotation: async (datasetId: string, annotationId: string) => { ... },
  convertToLabels: async (datasetId: string, options?: { imageIds?: string[]; folder?: string }) => { ... },
};
```

#### 2.2.2 Auto-save Strategy
- **Debounced Auto-save**: Save annotations 2 seconds after last change
- **Manual Save Button**: Also provide explicit save button
- **Unsaved Changes Warning**: Warn user before navigating away
- **Optimistic Updates**: Update UI immediately, sync with backend in background

#### 2.2.3 Error Handling
- Network errors: Retry with exponential backoff
- Validation errors: Show inline error messages
- Conflict errors: Show merge dialog if annotation was modified by another user

---

## Phase 3: Defect Category Management

### 3.1 Category Management UI

#### 3.1.1 Category Manager Component
```
src/components/annotation/CategoryManager.tsx
```

**Features:**
- List of existing categories
- Add new category (name, color, description)
- Edit category (rename, change color)
- Delete category (with confirmation if used in annotations)
- Reorder categories (drag & drop)
- Import/Export categories (JSON)

#### 3.1.2 Category Selector Component
```
src/components/annotation/CategorySelector.tsx
```

**Features:**
- Dropdown/combobox for selecting category
- Color-coded category chips
- Quick-add category button
- Search/filter categories
- Keyboard shortcuts (1-9 for first 9 categories)

### 3.2 Backend API Endpoints

#### 3.2.1 Get Categories
```
GET /api/dataset/:datasetId/categories
Response:
{
  categories: Array<{
    id: string;
    name: string;
    color: string;
    description?: string;
    createdAt: string;
    annotationCount?: number; // Optional: count of annotations using this category
  }>;
}
```

#### 3.2.2 Create Category
```
POST /api/dataset/:datasetId/categories
Body:
{
  name: string;
  color: string; // Hex color code
  description?: string;
}

Response:
{
  category: {
    id: string;
    name: string;
    color: string;
    description?: string;
    createdAt: string;
  };
}
```

#### 3.2.3 Update Category
```
PUT /api/dataset/:datasetId/categories/:categoryId
Body:
{
  name?: string;
  color?: string;
  description?: string;
}

Response:
{
  category: { ... };
  message: "Category updated";
}
```

#### 3.2.4 Delete Category
```
DELETE /api/dataset/:datasetId/categories/:categoryId
Query Params:
  - reassignTo?: string (optional: categoryId to reassign annotations to)

Response:
{
  message: "Category deleted";
  reassignedCount?: number; // If reassignTo was provided
}
```

#### 3.2.5 Reorder Categories
```
PUT /api/dataset/:datasetId/categories/reorder
Body:
{
  categoryIds: string[]; // Ordered array of category IDs
}

Response:
{
  message: "Categories reordered";
}
```

### 3.3 Default Categories
- Provide preset categories on first annotation session:
  - "Defect" (red)
  - "Good" (green)
  - "Unknown" (gray)
- Allow user to customize immediately

### 3.4 Category Persistence
- Store categories per dataset (not global)
- Categories can be shared across dataset versions
- Migration: When converting annotations to labels, map categories to class indices

---

## Phase 4: Model Weight File Downloads

### 4.1 Current State Analysis
- **Location**: `SimulationView.tsx` line 2155-2166
- **Current Implementation**: `modelInfo.downloadUrl` exists but may not be functional
- **Display**: Link shown in training results after completion

### 4.2 Requirements

#### 4.2.1 Download Button Enhancement
- **Location 1**: Training completion results (already exists, verify functionality)
- **Location 2**: Trained models list (line 1447-1709 in SimulationView.tsx)
- **Location 3**: Model details expansion panel

#### 4.2.2 Download Options
- **Single File**: Download `.pt` or `.weights` file
- **Bundle Download**: Download model + config + metadata as ZIP
- **Format Selection**: Choose between PyTorch (.pt), ONNX (.onnx), TensorFlow (.pb) if available

### 4.3 Backend API Endpoints

#### 4.3.1 Get Model Download URL
```
GET /api/models/:modelId/download-url
Query Params:
  - format?: 'pt' | 'onnx' | 'pb' | 'bundle' (default: 'pt')

Response:
{
  downloadUrl: string; // Signed URL or direct download link
  expiresAt?: string; // If using signed URLs
  format: string;
  size: number; // File size in bytes
  filename: string;
}
```

#### 4.3.2 Download Model File
```
GET /api/models/:modelId/download
Query Params:
  - format?: 'pt' | 'onnx' | 'pb' | 'bundle' (default: 'pt')

Response:
- Binary file stream
- Headers:
  - Content-Type: application/octet-stream
  - Content-Disposition: attachment; filename="model.pt"
  - Content-Length: <file-size>
```

#### 4.3.3 Get Model Bundle
```
GET /api/models/:modelId/bundle
Response:
- ZIP file containing:
  - model.pt (or selected format)
  - config.json (hyperparameters, training info)
  - metadata.json (model version, metrics, etc.)
  - README.txt (usage instructions)
```

### 4.4 Frontend Implementation

#### 4.4.1 Download Service
```typescript
// src/lib/api/models.ts
export const modelApi = {
  getDownloadUrl: async (modelId: string, format?: string) => { ... },
  downloadModel: async (modelId: string, format?: string) => { ... },
  downloadBundle: async (modelId: string) => { ... },
};
```

#### 4.4.2 Download Component
```typescript
// src/components/training/ModelDownloadButton.tsx
- Dropdown menu with format options
- Progress indicator for large files
- Error handling for failed downloads
- Success toast notification
```

#### 4.4.3 Integration Points
1. **Training Results** (line 2155-2166): Enhance existing download link
2. **Trained Models List** (line 1447-1709): Add download button to each model card
3. **Model Details Panel**: Add download section in expanded view

---

## Implementation Phases & Timeline

### Phase 1: Foundation (Week 1)
**Goal**: Set up annotation infrastructure

**Tasks:**
1. Create annotation component structure
2. Implement basic image viewer with zoom/pan
3. Create bounding box drawing canvas
4. Set up annotation state management
5. Integrate annotation mode toggle in SimulationView

**Deliverables:**
- AnnotationWorkspace component skeleton
- ImageViewer component (reuse from DatasetManager)
- Basic bounding box drawing functionality
- Navigation between unlabeled images

### Phase 2: Backend Integration (Week 1-2)
**Goal**: Connect frontend to backend APIs

**Tasks:**
1. Implement backend API endpoints (or coordinate with backend team)
2. Create frontend API service layer
3. Implement auto-save functionality
4. Add error handling and retry logic
5. Test annotation persistence

**Deliverables:**
- Complete API integration
- Auto-save working
- Error handling implemented

### Phase 3: Category Management (Week 2)
**Goal**: Full category management system

**Tasks:**
1. Create CategoryManager component
2. Implement category CRUD operations
3. Add category selector to annotation interface
4. Implement category persistence
5. Add default categories

**Deliverables:**
- Category management UI
- Category API integration
- Category assignment in annotations

### Phase 4: Polish & Optimization (Week 2-3)
**Goal**: Improve UX and performance

**Tasks:**
1. Add keyboard shortcuts
2. Implement undo/redo
3. Add annotation progress tracking
4. Optimize image loading (lazy loading, caching)
5. Add annotation statistics dashboard
6. Implement batch operations

**Deliverables:**
- Polished annotation interface
- Performance optimizations
- User documentation

### Phase 5: Model Downloads (Week 3)
**Goal**: Enable model weight downloads

**Tasks:**
1. Verify/implement backend download endpoints
2. Create download button components
3. Add download options (format selection)
4. Implement bundle download
5. Add download progress indicators
6. Test download functionality

**Deliverables:**
- Working download functionality
- Download buttons in all relevant locations
- Multiple format support

### Phase 6: Testing & Documentation (Week 3-4)
**Goal**: Ensure quality and usability

**Tasks:**
1. End-to-end testing
2. User acceptance testing
3. Performance testing
4. Update PROJECT_DOCUMENTATION.md
5. Create user guide for annotation workflow
6. Bug fixes and refinements

**Deliverables:**
- Tested and documented features
- User documentation
- Updated project documentation

---

## Technical Considerations

### 5.1 Performance
- **Image Loading**: Lazy load images, use thumbnails for grid
- **Annotation Rendering**: Use canvas for bounding boxes (better performance)
- **State Management**: Use React Context or Zustand for annotation state
- **Caching**: Cache loaded images and annotations in memory
- **Debouncing**: Debounce auto-save and search operations

### 5.2 Data Format
- **Bounding Box Format**: Normalized coordinates [x, y, width, height] (0-1 range)
- **YOLO Conversion**: Convert to YOLO format (class_id center_x center_y width height)
- **Category Mapping**: Map category names to class indices

### 5.3 User Experience
- **Keyboard Shortcuts**:
  - `Space`: Next image
  - `Shift+Space`: Previous image
  - `S`: Save
  - `D`: Draw bounding box
  - `Delete`: Delete selected annotation
  - `1-9`: Select category by number
- **Visual Feedback**: Loading states, success/error toasts, progress indicators
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### 5.4 Error Handling
- **Network Errors**: Retry with exponential backoff
- **Validation Errors**: Inline error messages
- **Conflict Resolution**: Show merge dialog for concurrent edits
- **Offline Support**: Queue annotations when offline, sync when online

### 5.5 Security
- **Authentication**: All API calls require Bearer token
- **Authorization**: Verify user has access to dataset
- **Input Validation**: Validate bounding box coordinates, category names
- **File Size Limits**: Enforce limits on annotation data

---

## File Structure

```
src/
├── components/
│   ├── annotation/
│   │   ├── AnnotationWorkspace.tsx
│   │   ├── ImageViewer.tsx
│   │   ├── BoundingBoxCanvas.tsx
│   │   ├── CategorySelector.tsx
│   │   ├── CategoryManager.tsx
│   │   ├── AnnotationToolbar.tsx
│   │   ├── ImageThumbnailGrid.tsx
│   │   └── AnnotationProgress.tsx
│   └── training/
│       └── ModelDownloadButton.tsx
├── lib/
│   ├── api/
│   │   ├── annotations.ts
│   │   └── models.ts
│   └── utils/
│       ├── annotationUtils.ts (bbox conversion, YOLO format, etc.)
│       └── categoryUtils.ts
├── hooks/
│   ├── useAnnotation.ts
│   ├── useCategories.ts
│   └── useModelDownload.ts
└── pages/
    └── (SimulationView.tsx - modifications)
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    // For canvas drawing (if not using native canvas)
    "react-canvas-draw": "^1.2.1", // Optional
    // For image manipulation
    "react-image-crop": "^10.1.8", // Optional
    // For file downloads
    "file-saver": "^2.0.5",
    "jszip": "^3.10.1" // For bundle downloads
  }
}
```

---

## Testing Checklist

### Annotation Features
- [ ] Can open annotation workspace for unlabeled dataset
- [ ] Can navigate between images
- [ ] Can draw bounding boxes
- [ ] Can assign categories to bounding boxes
- [ ] Can save annotations
- [ ] Auto-save works correctly
- [ ] Can edit existing annotations
- [ ] Can delete annotations
- [ ] Undo/redo works
- [ ] Keyboard shortcuts work
- [ ] Progress tracking accurate

### Category Management
- [ ] Can create new category
- [ ] Can edit category
- [ ] Can delete category
- [ ] Can reorder categories
- [ ] Default categories appear on first use
- [ ] Category colors display correctly
- [ ] Category selector works in annotation interface

### Backend Integration
- [ ] Annotations persist to backend
- [ ] Can load existing annotations
- [ ] Batch save works
- [ ] Convert to labels works
- [ ] Error handling works
- [ ] Retry logic works

### Model Downloads
- [ ] Download button appears after training completion
- [ ] Download button appears in trained models list
- [ ] Can download model file
- [ ] Can download model bundle
- [ ] Format selection works
- [ ] Download progress shows
- [ ] Error handling for failed downloads

---

## Success Criteria

1. ✅ Users can annotate unlabeled images before training
2. ✅ Annotations are saved and persist across sessions
3. ✅ Users can define and manage defect categories
4. ✅ Users can download trained model weight files
5. ✅ All features work seamlessly with existing training workflow
6. ✅ Performance is acceptable (< 2s load time for annotation workspace)
7. ✅ UI is intuitive and requires minimal learning curve
8. ✅ All edge cases handled gracefully

---

## Notes & Considerations

1. **Backend Coordination**: Some backend endpoints may need to be created. Coordinate with backend team early.

2. **Dataset Structure**: Ensure backend can identify unlabeled images (images without corresponding .txt label files).

3. **YOLO Format**: When converting annotations to labels, ensure proper YOLO format:
   ```
   class_id center_x center_y width height
   ```
   All values normalized 0-1.

4. **Migration Path**: Consider how to handle existing unlabeled datasets - should they be automatically available for annotation?

5. **Performance**: For large datasets (1000+ images), implement pagination and virtual scrolling.

6. **Mobile Support**: Consider if annotation should work on tablets (touch support for drawing).

7. **Collaboration**: If multiple users can annotate same dataset, implement conflict resolution.

---

**Last Updated**: [Current Date]
**Status**: Planning Phase
**Next Steps**: Begin Phase 1 implementation


