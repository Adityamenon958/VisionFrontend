# Phase 4 Plan: UX Polish & Performance Optimization

## Objective
Improve performance, usability, accessibility, and stability of the annotation tool without adding new core features.

---

## Task 1: Performance Optimizations

### 1.1 BoundingBoxCanvas Optimizations

**File: `src/components/annotation/BoundingBoxCanvas.tsx`**

**Throttle mousemove:**
- Use `requestAnimationFrame` to throttle mousemove updates
- Store pending update in ref
- Only render on animation frame

**Memoize rendered boxes:**
- Use `React.memo` for bounding box components
- Memoize `renderBoundingBox` function with `useMemo`
- Dependencies: annotation data, categories, selectedAnnotationId

**Cache coordinate conversions:**
- Create utility functions: `normalizeCoords()`, `denormalizeCoords()`
- Cache calculations in `useMemo` hooks

### 1.2 Thumbnail Rendering

**File: `src/components/annotation/ImageThumbnailGrid.tsx`**

- Memoize thumbnail components with `React.memo`
- Lazy load thumbnails (only render visible ones)
- Use `useMemo` for filtered/sorted image lists

---

## Task 2: Image & Loading UX

### 2.1 Image Loading States

**File: `src/components/annotation/ImageViewer.tsx`**

**Add loading indicator:**
- Show spinner/skeleton while image loads
- Use `onLoad` and `onError` handlers
- Disable drawing until `imageLoaded === true`

**Handle broken images:**
- Show placeholder with error message
- Retry button (optional)
- Graceful fallback UI

**Props:**
```typescript
interface ImageViewerProps {
  imageUrl: string | null;
  imageId: string | null;
  onLoad?: () => void;
  onError?: () => void;
}
```

### 2.2 Drawing State Management

**File: `src/components/annotation/AnnotationWorkspace.tsx`**

- Track `imageLoaded` state
- Disable drawing when `!imageLoaded`
- Show tooltip: "Image loading... Please wait"

---

## Task 3: Visual Feedback & Selection

### 3.1 Bounding Box States

**File: `src/components/annotation/BoundingBoxCanvas.tsx`**

**Hover state:**
- Add `:hover` styles to boxes
- Slightly thicker border on hover
- Show category name on hover (if not already visible)

**Selected state:**
- Enhanced ring/border (already implemented)
- Add subtle shadow
- Ensure selected box is always on top (z-index)

**Cursor styles:**
- `crosshair` when `isDrawing === true`
- `pointer` when hovering over box
- `default` otherwise

### 3.2 Empty & Warning States

**File: `src/components/annotation/AnnotationWorkspace.tsx`**

**Empty states (no alerts):**
- No images: "No images available"
- No annotations: Subtle hint "Draw a bounding box to get started"
- No category selected: Visual indicator in category selector

**Warning states:**
- Unsaved changes: Already implemented (amber dot)
- Image loading: Loading indicator
- Save error: Error message (non-blocking)

---

## Task 4: Undo / Redo UX

### 4.1 Button States

**File: `src/components/annotation/AnnotationToolbar.tsx`**

- Disable buttons when `!canUndo` / `!canRedo`
- Add tooltips:
  - "Undo (Ctrl+Z)" / "Nothing to undo"
  - "Redo (Ctrl+Shift+Z)" / "Nothing to redo"

### 4.2 History Management

**File: `src/hooks/useAnnotation.ts`**

**Clear redo stack:**
- When new annotation is added after undo
- Clear `redoStack` (history after current index)
- Reset `historyIndex` appropriately

---

## Task 5: Keyboard & Accessibility

### 5.1 Scope Keyboard Shortcuts

**File: `src/components/annotation/AnnotationWorkspace.tsx`**

**Focus management:**
- Only activate shortcuts when workspace is focused
- Use `useRef` to track focus state
- Add `tabIndex={0}` to workspace container
- Handle `onFocus` / `onBlur` events

**Ignore when typing:**
- Check if `document.activeElement` is input/textarea
- Skip shortcut handling if typing

### 5.2 ARIA Labels

**Add to components:**
- `BoundingBoxCanvas`: `aria-label="Annotation canvas"`
- `CategorySelector`: `aria-label="Category selector"`
- `AnnotationToolbar`: `aria-label="Annotation tools"`
- Buttons: Descriptive `aria-label` attributes

### 5.3 Keyboard Navigation

**Tab order:**
- Logical tab sequence through controls
- Focus trap within workspace (optional, for modal-like behavior)

**File: `src/hooks/useAnnotationShortcuts.ts` (NEW)**

- Extract keyboard shortcut logic
- Handle focus/typing checks
- Return cleanup function

---

## Task 6: Stats & Progress Polish

### 6.1 Animated Progress Bar

**File: `src/components/annotation/AnnotationProgress.tsx`**

- Add animated progress bar (CSS transitions)
- Smooth percentage updates
- Visual progress indicator

### 6.2 Statistics Readability

**File: `src/components/annotation/AnnotationStats.tsx`**

- Improve typography and spacing
- Add icons for visual clarity
- Better number formatting (commas, etc.)
- Color-coded category stats

---

## Task 7: Code Quality

### 7.1 Extract Utilities

**File: `src/lib/utils/bboxUtils.ts` (NEW)**
```typescript
export const normalizeCoords = (pixel: number, dimension: number): number;
export const denormalizeCoords = (normalized: number, dimension: number): number;
export const calculateBbox = (startX, startY, endX, endY): [number, number, number, number];
export const validateBbox = (bbox, minSize): boolean;
```

**File: `src/hooks/useAnnotationShortcuts.ts` (NEW)**
- Extract keyboard shortcut logic from AnnotationWorkspace
- Handle focus management
- Return cleanup function

**File: `src/hooks/useImageLoader.ts` (NEW)**
```typescript
export const useImageLoader = (imageUrl: string | null) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  // Handle onLoad, onError
  return { loaded, error, retry };
};
```

### 7.2 Error Boundary

**File: `src/components/annotation/AnnotationErrorBoundary.tsx` (NEW)**
- Wrap AnnotationWorkspace
- Catch rendering errors
- Show fallback UI with error message
- Log errors to console

### 7.3 Cleanup

**Review all components:**
- Remove unused imports
- Clean up event listeners in `useEffect` cleanup
- Ensure all refs are properly cleaned up
- Remove console.logs (keep console.error for errors)

---

## File Structure

```
src/
├── components/
│   └── annotation/
│       ├── BoundingBoxCanvas.tsx          # MODIFY: Performance + visual feedback
│       ├── ImageViewer.tsx                  # MODIFY: Loading states
│       ├── ImageThumbnailGrid.tsx           # MODIFY: Memoization
│       ├── AnnotationToolbar.tsx            # MODIFY: Tooltips, disabled states
│       ├── AnnotationProgress.tsx           # MODIFY: Animated progress
│       ├── AnnotationStats.tsx              # MODIFY: Readability
│       └── AnnotationErrorBoundary.tsx       # NEW: Error boundary
├── hooks/
│   ├── useAnnotationShortcuts.ts           # NEW: Keyboard shortcuts
│   └── useImageLoader.ts                    # NEW: Image loading
├── lib/
│   └── utils/
│       └── bboxUtils.ts                     # NEW: Bbox utilities
└── components/
    └── annotation/
        └── AnnotationWorkspace.tsx          # MODIFY: Integration
```

---

## Implementation Checklist

### Performance
- [ ] Throttle mousemove with requestAnimationFrame
- [ ] Memoize bounding box rendering
- [ ] Cache coordinate conversions
- [ ] Memoize thumbnail components
- [ ] Lazy load thumbnails

### Image Loading
- [ ] Add loading indicator
- [ ] Disable drawing until loaded
- [ ] Handle broken images
- [ ] Add retry functionality

### Visual Feedback
- [ ] Add hover states to boxes
- [ ] Improve selected state styling
- [ ] Update cursor styles
- [ ] Improve empty states
- [ ] Add warning indicators

### Undo/Redo
- [ ] Disable buttons when unavailable
- [ ] Add tooltips
- [ ] Clear redo stack on new annotation

### Accessibility
- [ ] Scope shortcuts to workspace focus
- [ ] Ignore shortcuts when typing
- [ ] Add ARIA labels
- [ ] Improve keyboard navigation
- [ ] Extract shortcut hook

### Stats & Progress
- [ ] Animate progress bar
- [ ] Improve statistics readability
- [ ] Add icons/formatting

### Code Quality
- [ ] Extract bboxUtils
- [ ] Extract useAnnotationShortcuts
- [ ] Extract useImageLoader
- [ ] Add error boundary
- [ ] Clean up event listeners
- [ ] Remove unused code

---

## Success Criteria

✅ Smooth 60fps drawing experience
✅ No lag when moving mouse
✅ Clear visual feedback for all interactions
✅ Accessible keyboard navigation
✅ Graceful error handling
✅ Clean, maintainable code structure
✅ No performance regressions

---

## Constraints (Strict)

❌ NO backend integration
❌ NO YOLO export
❌ NO downloads
❌ NO new core features
❌ NO persistence across reload

---

## Technical Details

### requestAnimationFrame Throttling
```typescript
const rafRef = useRef<number>();
const pendingUpdate = useRef<{ x: number; y: number } | null>(null);

const handleMouseMove = (e: MouseEvent) => {
  pendingUpdate.current = getMousePosition(e);
  if (!rafRef.current) {
    rafRef.current = requestAnimationFrame(() => {
      if (pendingUpdate.current) {
        updateDrawingState(pendingUpdate.current);
        pendingUpdate.current = null;
      }
      rafRef.current = undefined;
    });
  }
};
```

### Memoization Pattern
```typescript
const MemoizedBoundingBox = React.memo(({ annotation, ... }) => {
  // Render logic
}, (prev, next) => {
  return prev.annotation.id === next.annotation.id &&
         prev.isSelected === next.isSelected;
});
```

### Focus Management
```typescript
const workspaceRef = useRef<HTMLDivElement>(null);
const [isFocused, setIsFocused] = useState(false);

useEffect(() => {
  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);
  workspaceRef.current?.addEventListener('focus', handleFocus);
  workspaceRef.current?.addEventListener('blur', handleBlur);
  return () => { /* cleanup */ };
}, []);
```

---

## Next Steps (Phase 5)

After Phase 4 completion:
- Backend API integration
- YOLO export functionality
- Download trained models
- Multi-user collaboration
- Advanced annotation features

---

**Estimated Time**: 4-6 hours
**Complexity**: Medium (optimization + polish)
**Dependencies**: Phase 1-3 complete

