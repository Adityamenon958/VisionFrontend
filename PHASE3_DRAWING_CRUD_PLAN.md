# Phase 3 Plan: Bounding Box Drawing & Category CRUD

## Objective
Add functional annotation capabilities: bounding box drawing on canvas and full category CRUD, using in-memory state and mock APIs only.

---

## Task 1: Bounding Box Drawing

### File: `src/components/annotation/BoundingBoxCanvas.tsx`

### Implementation

**Mouse Event Handlers:**
```typescript
interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// State
const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
const canvasRef = useRef<HTMLDivElement>(null);
```

**Mouse Events:**
1. **mousedown**: Start drawing
   - Get mouse position relative to image
   - Normalize coordinates (0-1)
   - Set `isDrawing = true`
   - Store start position

2. **mousemove**: Update active box
   - Calculate current box dimensions
   - Update `drawingState` with current position
   - Re-render active box (dashed border)

3. **mouseup**: Finalize box
   - Calculate final normalized bbox: `[x, y, width, height]`
   - Validate: min size (e.g., 10x10 pixels)
   - Require `selectedCategoryId` (show error if none)
   - Call `addAnnotation()` from hook
   - Reset drawing state
   - Trigger auto-save

**Rendering:**
- **Active box** (while drawing): Dashed border, semi-transparent
- **Saved boxes**: Solid border, category color, label overlay
- **Coordinate conversion**: Normalized (0-1) ↔ Pixel coordinates

**Props Update:**
```typescript
interface BoundingBoxCanvasProps {
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
  categories: Category[];
  selectedCategoryId: string | null;
  isDrawing: boolean;
  onBboxDraw?: (bbox: [number, number, number, number]) => void;
  onAnnotationClick?: (annotationId: string) => void;
}
```

---

## Task 2: Category CRUD

### 2.1 Extend Mock API

**File: `src/lib/api/mock/categories.mock.ts`**

**Add Functions:**

1. **createCategory(datasetId, { name, color, description? })**
   - Generate ID
   - Store in memory
   - Return: `Promise<{ category: Category }>`

2. **updateCategory(datasetId, categoryId, { name?, color?, description? })**
   - Update in memory
   - Return: `Promise<{ category: Category, message: string }>`

3. **deleteCategory(datasetId, categoryId, reassignTo?: string)**
   - If `reassignTo` provided: reassign annotations
   - Delete category
   - Return: `Promise<{ message: string, reassignedCount?: number }>`

4. **reorderCategories(datasetId, categoryIds: string[])**
   - Reorder in memory
   - Return: `Promise<{ message: string }>`

**Default Categories:**
- Ensure "Defect", "Good", "Unknown" exist on first load
- Create if missing

### 2.2 Category Manager Component

**File: `src/components/annotation/CategoryManager.tsx`**

**Features:**
- List categories with color chips
- **Create**: Dialog with name input + color picker
- **Edit**: Inline or dialog editing
- **Delete**: Confirmation + reassignment option
- **Reorder**: Drag & drop (optional) or up/down buttons
- **Color Picker**: Use HTML color input or preset palette

**Props:**
```typescript
interface CategoryManagerProps {
  categories: Category[];
  onCategoryCreate: (category: Omit<Category, "id">) => void;
  onCategoryUpdate: (id: string, updates: Partial<Category>) => void;
  onCategoryDelete: (id: string, reassignTo?: string) => void;
  onCategoryReorder: (categoryIds: string[]) => void;
}
```

**Integration:**
- Add "Manage Categories" button in CategorySelector
- Open CategoryManager in dialog/sheet

---

## Task 3: Category Integration

### 3.1 Require Category Before Drawing

**In BoundingBoxCanvas:**
- Check `selectedCategoryId` on mouseup
- If null: Show toast/alert "Please select a category first"
- Prevent annotation creation

**In AnnotationWorkspace:**
- Auto-select first category on load
- Show warning if no categories exist

### 3.2 Update Annotation on Category Change

**In AnnotationWorkspace:**
```typescript
// When category changes, update selected annotation (if any)
useEffect(() => {
  if (selectedAnnotationId && selectedCategoryId) {
    updateAnnotation(selectedAnnotationId, {
      categoryId: selectedCategoryId,
      categoryName: getCategoryName(selectedCategoryId),
    });
  }
}, [selectedCategoryId]);
```

### 3.3 Color-Coded Boxes

- Already implemented in Phase 2
- Ensure colors update when category changes

---

## Task 4: Keyboard Shortcuts

### Implementation in AnnotationWorkspace.tsx

**useEffect Hook:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // D → draw mode
    if (e.key === 'd' || e.key === 'D') {
      setDrawing(true);
    }
    
    // Esc → cancel draw
    if (e.key === 'Escape') {
      setDrawing(false);
      // Cancel active drawing if any
    }
    
    // Delete → delete selected annotation
    if (e.key === 'Delete' && selectedAnnotationId) {
      deleteAnnotation(selectedAnnotationId);
    }
    
    // Ctrl+Z → undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    
    // Ctrl+Shift+Z → redo
    if (e.ctrlKey && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      redo();
    }
    
    // 1-9 → select category
    const categoryIndex = parseInt(e.key) - 1;
    if (categoryIndex >= 0 && categoryIndex < categories.length) {
      setCategory(categories[categoryIndex].id);
    }
    
    // Arrow keys → image navigation
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePreviousImage();
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNextImage();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [categories, selectedAnnotationId, ...]);
```

**Requirements:**
- Only active when AnnotationWorkspace is focused
- Show tooltip/hint with shortcuts
- Prevent default browser behavior where needed

---

## Task 5: Annotation Statistics

### Component: `src/components/annotation/AnnotationStats.tsx`

**Display:**
- Total images: `images.length`
- Annotated images: Count unique `imageId` in annotations
- Total boxes: `annotations.length`
- Boxes per category: Group by `categoryId`, show count + percentage

**Props:**
```typescript
interface AnnotationStatsProps {
  images: Image[];
  annotations: Annotation[];
  categories: Category[];
}
```

**Integration:**
- Add stats panel in AnnotationWorkspace sidebar or header
- Update in real-time as annotations change

---

## File Structure

```
src/
├── components/
│   └── annotation/
│       ├── BoundingBoxCanvas.tsx      # MODIFY: Add drawing logic
│       ├── CategoryManager.tsx         # NEW: Category CRUD UI
│       └── AnnotationStats.tsx        # NEW: Statistics display
├── lib/
│   └── api/
│       └── mock/
│           └── categories.mock.ts      # MODIFY: Add CRUD functions
└── hooks/
    └── useAnnotation.ts                # MODIFY: Add selectedAnnotationId state
```

---

## Implementation Checklist

### Drawing
- [ ] Add mouse event handlers to BoundingBoxCanvas
- [ ] Implement coordinate normalization
- [ ] Render active box (dashed)
- [ ] Validate box size on finalize
- [ ] Require category selection
- [ ] Call addAnnotation on finalize
- [ ] Handle click to select annotation

### Category CRUD
- [ ] Extend categories.mock.ts with create/update/delete/reorder
- [ ] Create CategoryManager component
- [ ] Add color picker
- [ ] Implement create dialog
- [ ] Implement edit functionality
- [ ] Implement delete with reassignment
- [ ] Implement reorder
- [ ] Ensure default categories exist

### Integration
- [ ] Require category before drawing
- [ ] Update annotation on category change
- [ ] Wire CategoryManager to AnnotationWorkspace
- [ ] Update colors when categories change

### Keyboard Shortcuts
- [ ] Implement D key (draw mode)
- [ ] Implement Esc (cancel)
- [ ] Implement Delete (delete annotation)
- [ ] Implement Ctrl+Z / Ctrl+Shift+Z
- [ ] Implement 1-9 (category selection)
- [ ] Implement Arrow keys (navigation)
- [ ] Add keyboard shortcuts hint/tooltip

### Statistics
- [ ] Create AnnotationStats component
- [ ] Calculate total images
- [ ] Calculate annotated images
- [ ] Calculate total boxes
- [ ] Calculate boxes per category
- [ ] Integrate into AnnotationWorkspace

---

## Success Criteria

✅ Can draw bounding boxes with mouse
✅ Active box shows while drawing
✅ Saved boxes render with category colors
✅ Category selection required before drawing
✅ Can create/edit/delete/reorder categories
✅ Default categories exist
✅ Keyboard shortcuts work
✅ Annotation statistics display correctly
✅ No real HTTP requests
✅ All functionality uses mock APIs

---

## Constraints (Strict)

❌ NO backend integration
❌ NO YOLO conversion
❌ NO downloads
❌ NO multi-user logic
❌ NO persistence across reload
❌ NO advanced features (zoom, pan, etc.)

---

## Technical Details

### Coordinate Normalization
```typescript
// Pixel to normalized
const normalize = (pixel: number, dimension: number) => pixel / dimension;

// Normalized to pixel
const denormalize = (normalized: number, dimension: number) => normalized * dimension;

// Bbox format: [x, y, width, height] all normalized 0-1
```

### Box Validation
- Minimum size: 10x10 pixels
- Must be within image bounds
- Width/height must be positive

### Category Reassignment
- When deleting category, show dialog:
  - "Reassign annotations to:" [dropdown]
  - Or "Delete all annotations" [checkbox]
- Update all annotations with matching categoryId

---

## Next Steps (Phase 4)

After Phase 3 completion:
- Add zoom/pan to image viewer
- Add annotation selection/multi-select
- Add annotation editing (resize, move)
- Polish UI/UX
- Add annotation export

---

**Estimated Time**: 6-8 hours
**Complexity**: Medium-High (drawing logic + CRUD)
**Dependencies**: Phase 1 & 2 complete
