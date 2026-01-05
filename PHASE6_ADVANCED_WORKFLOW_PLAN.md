# Phase 6 Plan: Advanced Annotation Workflow & Collaboration

## Objective
Enhance annotation system with advanced workflows, collaboration readiness, and productivity features for multi-user, production-scale usage.

---

## Task 1: Advanced Annotation Editing

### 1.1 Select, Move, Resize Bounding Boxes

**File: `src/components/annotation/BoundingBoxCanvas.tsx`**

**Features:**
- Click to select annotation
- Drag selected box to move
- Drag corner/edge handles to resize
- Visual handles on selected box (8 handles: corners + edges)
- Constrain resize to maintain aspect ratio (optional, Shift key)

**Implementation:**
- Add resize handles to selected annotation
- Track drag state (move vs resize)
- Update bbox coordinates on drag end
- Call `updateAnnotation()` API on change

### 1.2 Multi-Select

**Features:**
- Shift+Click to add/remove from selection
- Drag selection box to select multiple
- Select all (Ctrl+A)
- Deselect all (Escape)

**Implementation:**
- Update `selectedAnnotationId` → `selectedAnnotationIds: string[]`
- Add selection box rendering
- Handle multi-select in click handlers

### 1.3 Copy / Paste / Duplicate

**Features:**
- Copy selected annotation(s) (Ctrl+C)
- Paste to current image (Ctrl+V)
- Duplicate annotation (Ctrl+D)
- Paste with offset (avoid overlap)

**Implementation:**
- Clipboard state management
- Paste handler creates new annotations with offset
- Call `saveAnnotation()` API for each pasted annotation

### 1.4 Confirmation Dialogs

**Features:**
- Confirm before delete (already implemented, enhance)
- Confirm before bulk delete
- Confirm before clearing all annotations

**Implementation:**
- Use AlertDialog for confirmations
- Show count of items to be deleted

---

## Task 2: Annotation Review Workflow

### 2.1 Annotation States

**Update Type: `src/types/annotation.ts`**
```typescript
type AnnotationState = "draft" | "reviewed" | "approved" | "rejected";

interface Annotation {
  // ... existing fields
  state?: AnnotationState;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}
```

### 2.2 State Management UI

**File: `src/components/annotation/AnnotationReviewToolbar.tsx` (NEW)**

**Features:**
- Filter by state (dropdown)
- Bulk state change (select multiple → change state)
- Review/Approve/Reject buttons
- Visual indicators (badges) on annotations

**Integration:**
- Add to AnnotationWorkspace sidebar
- Show state badges on bounding boxes
- Filter annotations by state

### 2.3 Backend API Updates

**Extend: `src/lib/api/annotations.ts`**

**New Functions:**
- `updateAnnotationState(datasetId, annotationId, state, userId)`
- `bulkUpdateAnnotationState(datasetId, annotationIds, state, userId)`
- `getAnnotationsByState(datasetId, state)`

**Backend Requirements:**
- Store `state`, `reviewedBy`, `reviewedAt`, `approvedBy`, `approvedAt`
- Validate state transitions (draft → reviewed → approved)
- Track reviewer/approver user IDs

### 2.4 Training Integration

**File: `src/components/SimulationView.tsx`**

**Feature:**
- Option to filter by approved annotations only
- Warning if using unapproved annotations
- Configurable setting (default: allow all)

---

## Task 3: Collaboration Readiness

### 3.1 Annotation Metadata Display

**File: `src/components/annotation/AnnotationMetadata.tsx` (NEW)**

**Display:**
- Created by (user name/email)
- Last modified by
- Created timestamp
- Modified timestamp
- Show on hover or in sidebar

**Integration:**
- Show metadata when annotation selected
- Add to AnnotationWorkspace info panel

### 3.2 Concurrent Edit Handling

**File: `src/components/annotation/AnnotationWorkspace.tsx`**

**Features:**
- Poll for annotation updates (every 5-10 seconds)
- Detect conflicts (annotation modified elsewhere)
- Show "Updated elsewhere" warning
- Reload button to fetch latest
- Optional: Auto-reload on conflict

**Implementation:**
- Use `useEffect` with interval polling
- Compare `updatedAt` timestamps
- Show conflict notification
- Call `getAnnotations()` to reload

### 3.3 Backend Requirements

**API Enhancements:**
- Include `createdBy`, `updatedBy`, `createdAt`, `updatedAt` in all responses
- Support `If-Modified-Since` header for efficient polling
- Return user info (name/email) for `createdBy`/`updatedBy` IDs

---

## Task 4: Import / Export

### 4.1 Export Annotations

**File: `src/components/annotation/AnnotationExportButton.tsx` (NEW)**

**Formats:**
- YOLO (already supported via conversion)
- COCO JSON (if backend supports)
- Custom JSON format

**Features:**
- Format selector dropdown
- Export all or filtered annotations
- Download file directly

**Backend API:**
- `GET /api/dataset/:datasetId/export-annotations?format=yolo|coco|json`

### 4.2 Import Annotations

**File: `src/components/annotation/AnnotationImportButton.tsx` (NEW)**

**Features:**
- File upload dialog
- Format detection (YOLO, COCO, JSON)
- Preview before import
- Validation (show errors)
- Import with mapping (category mapping)

**Backend API:**
- `POST /api/dataset/:datasetId/import-annotations`
- Body: file + format + options
- Response: validation results + import status

### 4.3 Validation

**Implementation:**
- Validate bbox coordinates (0-1 range)
- Validate category IDs exist
- Validate image IDs exist
- Show validation errors before import
- Allow partial import (skip invalid)

---

## Task 5: Analytics & Insights

### 5.1 Annotation Throughput Metrics

**File: `src/components/annotation/AnnotationAnalytics.tsx` (NEW)**

**Metrics:**
- Annotations per hour/day
- Average time per annotation
- Total annotations created
- Annotations by user (if multi-user)

**Display:**
- Time series chart (recharts)
- Summary cards
- Period selector (today, week, month)

### 5.2 Category Distribution Charts

**Enhance: `src/components/annotation/AnnotationStats.tsx`**

**Features:**
- Pie chart of category distribution
- Bar chart of annotations per category
- Trend over time (if timestamps available)

**Implementation:**
- Use recharts library
- Add chart components
- Show in expanded stats view

### 5.3 Annotator Performance Summary

**File: `src/components/annotation/AnnotatorPerformance.tsx` (NEW)**

**Metrics (if available):**
- Annotations per user
- Review/approval rates
- Average quality score (if tracked)

**Display:**
- Table of annotators
- Sortable columns
- Filter by date range

**Backend API:**
- `GET /api/dataset/:datasetId/annotator-stats?startDate&endDate`

---

## File Structure

```
src/
├── components/
│   ├── annotation/
│   │   ├── BoundingBoxCanvas.tsx          # MODIFY: Add move/resize/multi-select
│   │   ├── AnnotationReviewToolbar.tsx    # NEW: Review workflow UI
│   │   ├── AnnotationMetadata.tsx         # NEW: Metadata display
│   │   ├── AnnotationExportButton.tsx     # NEW: Export functionality
│   │   ├── AnnotationImportButton.tsx      # NEW: Import functionality
│   │   ├── AnnotationAnalytics.tsx          # NEW: Analytics dashboard
│   │   ├── AnnotatorPerformance.tsx         # NEW: Performance metrics
│   │   └── AnnotationStats.tsx            # MODIFY: Add charts
│   └── training/
│       └── (no changes)
├── lib/
│   └── api/
│       └── annotations.ts                  # MODIFY: Add state/review APIs
├── types/
│   └── annotation.ts                       # MODIFY: Add state, metadata fields
└── hooks/
    └── useAnnotationSelection.ts           # NEW: Multi-select logic
```

---

## Implementation Checklist

### Advanced Editing
- [ ] Add resize handles to selected boxes
- [ ] Implement drag to move
- [ ] Implement drag to resize
- [ ] Add multi-select (Shift+Click, drag box)
- [ ] Add copy/paste/duplicate
- [ ] Add confirmation dialogs

### Review Workflow
- [ ] Add state field to Annotation type
- [ ] Create AnnotationReviewToolbar
- [ ] Add state filter UI
- [ ] Add bulk state change
- [ ] Add state badges to boxes
- [ ] Extend backend API for state management
- [ ] Add training integration (approved filter)

### Collaboration
- [ ] Create AnnotationMetadata component
- [ ] Display metadata on selection
- [ ] Add polling for updates
- [ ] Add conflict detection
- [ ] Add reload on conflict
- [ ] Extend backend to include user metadata

### Import/Export
- [ ] Create AnnotationExportButton
- [ ] Support YOLO export
- [ ] Support COCO export (if backend supports)
- [ ] Create AnnotationImportButton
- [ ] Add file upload
- [ ] Add format detection
- [ ] Add validation
- [ ] Add preview before import

### Analytics
- [ ] Create AnnotationAnalytics component
- [ ] Add throughput metrics
- [ ] Add category distribution charts
- [ ] Add annotator performance (if available)
- [ ] Add time period selector

---

## Success Criteria

✅ Annotations can be moved and resized
✅ Multi-select works for bulk operations
✅ Copy/paste/duplicate functional
✅ Review workflow with states implemented
✅ Metadata visible for collaboration
✅ Concurrent edits handled gracefully
✅ Import/export works for supported formats
✅ Analytics dashboard shows key metrics
✅ No Phase 1-5 functionality broken

---

## Constraints (Strict)

❌ Do NOT change training or model logic
❌ Do NOT break backward compatibility
❌ Do NOT remove Phase 1-5 functionality
❌ Do NOT add features beyond scope

---

## Backend API Extensions Required

### Annotation State Management
```
PUT /api/dataset/:datasetId/annotations/:annotationId/state
Body: { state: "draft" | "reviewed" | "approved" | "rejected", userId: string }
```

### Bulk State Update
```
PUT /api/dataset/:datasetId/annotations/bulk-state
Body: { annotationIds: string[], state: string, userId: string }
```

### Export Annotations
```
GET /api/dataset/:datasetId/export-annotations?format=yolo|coco|json
Response: File download
```

### Import Annotations
```
POST /api/dataset/:datasetId/import-annotations
Body: FormData (file + format + options)
Response: { imported: number, failed: number, errors: [] }
```

### Annotator Stats
```
GET /api/dataset/:datasetId/annotator-stats?startDate&endDate
Response: { annotators: [{ userId, name, annotationCount, ... }] }
```

---

## Technical Details

### Multi-Select Implementation
```typescript
const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([]);

const handleBoxClick = (id: string, e: MouseEvent) => {
  if (e.shiftKey) {
    // Toggle selection
    setSelectedAnnotationIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  } else {
    // Single select
    setSelectedAnnotationIds([id]);
  }
};
```

### Move/Resize Implementation
```typescript
const handleMouseDown = (e: MouseEvent, annotation: Annotation, handle?: 'move' | 'resize') => {
  const startPos = getMousePosition(e);
  const onMouseMove = (e: MouseEvent) => {
    const currentPos = getMousePosition(e);
    if (handle === 'move') {
      // Calculate new bbox position
    } else if (handle === 'resize') {
      // Calculate new bbox size
    }
  };
  // ... attach listeners
};
```

### Conflict Detection
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const latest = await getAnnotations(datasetId, currentImage?.id);
    const conflicts = annotations.filter(ann => {
      const latestAnn = latest.find(a => a.id === ann.id);
      return latestAnn && latestAnn.updatedAt !== ann.updatedAt;
    });
    if (conflicts.length > 0) {
      setHasConflicts(true);
    }
  }, 5000);
  return () => clearInterval(interval);
}, [annotations]);
```

---

## Next Steps (Post Phase 6)

After Phase 6 completion:
- Advanced ML-assisted annotation (pre-annotation)
- Quality assurance workflows
- Annotation templates
- Custom annotation tools
- Advanced collaboration features

---

**Estimated Time**: 10-14 hours
**Complexity**: High (advanced UI interactions + collaboration)
**Dependencies**: Phase 1-5 complete, backend API extensions


