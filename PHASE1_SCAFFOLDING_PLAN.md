# Phase 1 Scaffolding Plan: Annotation UI Structure

## Objective
Create UI scaffolding and component structure for annotation feature without backend integration or functional logic.

---

## Task 1: Annotation Mode Toggle in SimulationView.tsx

### Location
- File: `src/components/SimulationView.tsx`
- Insert point: After dataset selection card (around line 1346), before model selection card

### Changes Required

#### 1.1 Add State
```typescript
const [annotationMode, setAnnotationMode] = useState<"training" | "annotation">("training");
```

#### 1.2 Add Conditional Button
```typescript
// After dataset selection card, before model selection
{selectedDatasetId && datasetDetails?.unlabeledImages > 0 && (
  <Button onClick={() => setAnnotationMode("annotation")}>
    Annotate Unlabeled Data
  </Button>
)}
```

#### 1.3 Conditional Rendering
```typescript
// Wrap existing training UI in conditional
{annotationMode === "training" && (
  // ... existing training UI ...
)}

{annotationMode === "annotation" && (
  <AnnotationWorkspace
    datasetId={selectedDatasetId}
    onClose={() => setAnnotationMode("training")}
  />
)}
```

---

## Task 2: Create Component Structure

### Folder Structure
```
src/components/annotation/
├── AnnotationWorkspace.tsx
├── ImageViewer.tsx
├── BoundingBoxCanvas.tsx
├── AnnotationToolbar.tsx
├── CategorySelector.tsx
├── ImageThumbnailGrid.tsx
└── AnnotationProgress.tsx
```

### Component Specifications

#### 2.1 AnnotationWorkspace.tsx
**Purpose**: Main container component
**Props**:
```typescript
interface AnnotationWorkspaceProps {
  datasetId: string;
  onClose: () => void;
}
```
**Structure**:
- Header with close button
- Grid layout: ImageViewer + BoundingBoxCanvas (center), CategorySelector (sidebar), ImageThumbnailGrid (bottom/left), AnnotationProgress (top)
- Placeholder text: "Annotation Workspace - Dataset: {datasetId}"

#### 2.2 ImageViewer.tsx
**Purpose**: Image display shell
**Props**:
```typescript
interface ImageViewerProps {
  imageUrl: string | null;
  imageId: string | null;
  onImageLoad?: () => void;
}
```
**Structure**:
- Container div with image element
- Placeholder: "Image Viewer - {imageId || 'No image selected'}"

#### 2.3 BoundingBoxCanvas.tsx
**Purpose**: Canvas overlay for bounding boxes
**Props**:
```typescript
interface BoundingBoxCanvasProps {
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
  onBboxDraw?: (bbox: BBox) => void;
}
```
**Structure**:
- Canvas element positioned absolutely over ImageViewer
- Placeholder: Empty canvas (no drawing logic yet)

#### 2.4 AnnotationToolbar.tsx
**Purpose**: Tool buttons UI
**Props**:
```typescript
interface AnnotationToolbarProps {
  onDraw?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}
```
**Structure**:
- Button row: Draw, Delete, Undo, Redo
- Buttons disabled (no onClick handlers yet)

#### 2.5 CategorySelector.tsx
**Purpose**: Category dropdown placeholder
**Props**:
```typescript
interface CategorySelectorProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onCategorySelect?: (categoryId: string) => void;
  onAddCategory?: () => void;
}
```
**Structure**:
- Select dropdown with placeholder "Select category"
- "Add Category" button (disabled)

#### 2.6 ImageThumbnailGrid.tsx
**Purpose**: Thumbnail navigation panel
**Props**:
```typescript
interface ImageThumbnailGridProps {
  images: Image[];
  currentImageId: string | null;
  onImageSelect?: (imageId: string) => void;
}
```
**Structure**:
- Grid of placeholder divs (no actual thumbnails yet)
- Each item shows: "Image {index}"
- Current image highlighted

#### 2.7 AnnotationProgress.tsx
**Purpose**: Progress indicator
**Props**:
```typescript
interface AnnotationProgressProps {
  current: number;
  total: number;
  annotated: number;
}
```
**Structure**:
- Text: "Progress: {current} of {total} images ({annotated} annotated)"

---

## Task 3: Type Definitions

### Create Type File
**File**: `src/types/annotation.ts`

```typescript
// Core types matching API contracts from plan

export interface Image {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  folder?: string;
  size?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface Annotation {
  id: string;
  imageId: string;
  bbox: [number, number, number, number]; // [x, y, width, height] normalized 0-1
  categoryId: string;
  categoryName: string;
}

export type BBox = [number, number, number, number];
```

---

## Task 4: Mock Data Setup

### Create Mock Data File
**File**: `src/lib/mocks/annotationMocks.ts`

```typescript
// Mock data for development
export const mockImages: Image[] = [
  { id: "1", filename: "image1.jpg", url: "/placeholder.jpg" },
  { id: "2", filename: "image2.jpg", url: "/placeholder.jpg" },
  // ... 5-10 mock images
];

export const mockCategories: Category[] = [
  { id: "1", name: "Defect", color: "#ef4444" },
  { id: "2", name: "Good", color: "#22c55e" },
  { id: "3", name: "Unknown", color: "#6b7280" },
];

export const mockAnnotations: Annotation[] = [];
```

---

## Task 5: Basic Layout Structure

### AnnotationWorkspace Layout
```
┌─────────────────────────────────────────────────┐
│ [Close] Annotation Workspace          [Progress] │
├──────────┬──────────────────────────┬───────────┤
│          │                          │           │
│ Category │   ImageViewer            │  Toolbar  │
│ Selector │   + BoundingBoxCanvas    │           │
│          │                          │           │
│          │                          │           │
├──────────┴──────────────────────────┴───────────┤
│         ImageThumbnailGrid                      │
└─────────────────────────────────────────────────┘
```

**Implementation**:
- Use CSS Grid or Flexbox for layout
- No styling polish - basic borders/backgrounds only
- Responsive not required yet

---

## Task 6: Integration Checklist

### Files to Create
- [ ] `src/components/annotation/AnnotationWorkspace.tsx`
- [ ] `src/components/annotation/ImageViewer.tsx`
- [ ] `src/components/annotation/BoundingBoxCanvas.tsx`
- [ ] `src/components/annotation/AnnotationToolbar.tsx`
- [ ] `src/components/annotation/CategorySelector.tsx`
- [ ] `src/components/annotation/ImageThumbnailGrid.tsx`
- [ ] `src/components/annotation/AnnotationProgress.tsx`
- [ ] `src/types/annotation.ts`
- [ ] `src/lib/mocks/annotationMocks.ts`

### Files to Modify
- [ ] `src/components/SimulationView.tsx`
  - Add `annotationMode` state
  - Add toggle button
  - Add conditional rendering
  - Import `AnnotationWorkspace`

---

## Implementation Steps

1. **Create type definitions** (`src/types/annotation.ts`)
2. **Create mock data** (`src/lib/mocks/annotationMocks.ts`)
3. **Create all 7 annotation components** (empty shells with props)
4. **Wire up AnnotationWorkspace** (import and render child components)
5. **Add toggle to SimulationView** (state + button + conditional render)
6. **Test navigation flow** (toggle between training/annotation modes)

---

## Success Criteria

✅ All 7 components exist with correct props interfaces
✅ AnnotationWorkspace renders with all child components
✅ Toggle button appears when `unlabeledImages > 0`
✅ Clicking toggle switches to annotation view
✅ Close button returns to training view
✅ No TypeScript errors
✅ No console errors
✅ No backend calls attempted

---

## Constraints (Strict)

❌ NO backend API calls
❌ NO annotation drawing logic
❌ NO state management (Context/Zustand) yet
❌ NO category CRUD
❌ NO bounding box calculations
❌ NO styling polish
❌ NO real image loading
❌ NO persistence

---

## Next Steps (Phase 2)

After Phase 1 completion:
- Add state management (Context/Zustand)
- Implement mock API layer
- Add bounding box drawing logic
- Wire up category selection
- Add image navigation

---

**Estimated Time**: 2-3 hours
**Complexity**: Low (structure only)
**Dependencies**: None
