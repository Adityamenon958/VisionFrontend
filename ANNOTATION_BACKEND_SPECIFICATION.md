# Annotation Feature - Backend Specification

## Overview

This document specifies the backend requirements for the Annotation feature. The frontend is fully implemented and depends on these APIs to function correctly.

The annotation system allows users to:
1. View unlabeled images from a dataset
2. Draw bounding boxes on images to mark defects or objects
3. Assign categories to annotations
4. Manage categories (create, update, delete, reorder)
5. Convert annotations to YOLO label format for training
6. Review and manage annotation states (draft, reviewed, approved, rejected)
7. Export/import annotations in various formats

**Critical**: All endpoints must follow the exact request/response contracts specified below. Any deviation will break the frontend.

---

## Complete Workflow

### 1. Dataset Selection
- User selects an unlabeled dataset version in the training section
- Frontend checks if dataset has unlabeled images (`unlabeledImages > 0`)
- Frontend displays "Annotate Unlabeled Data" button

### 2. Start Annotation
- User clicks "Annotate Unlabeled Data"
- Frontend → Backend: `GET /api/dataset/:datasetId/unlabeled-images`
  - Backend returns images where `hasLabels = false` or no `.txt` label file exists
  - Returns signed URLs for images and thumbnails
- Frontend → Backend: `GET /api/dataset/:datasetId/categories`
  - Backend returns categories (creates defaults: "Defect", "Good", "Unknown" if dataset is new)

### 3. Category Setup
- User can use default categories or create custom categories
- Frontend → Backend: `POST /api/dataset/:datasetId/categories` (for custom categories)
- Categories are dataset-specific (not global)

### 4. Manual Annotation
- User draws bounding boxes on images and assigns categories
- Frontend stores annotations locally (normalized coordinates [x, y, width, height] 0-1)
- Auto-save (every 2 seconds):
  - Frontend → Backend: `POST /api/dataset/:datasetId/annotations/batch`
  - Backend validates image has `hasLabels = false` (CRITICAL)
  - Backend stores annotations with denormalized `categoryName`

### 5. YOLO Conversion (Before Training)
- User clicks "Convert to YOLO" button
- Frontend → Backend: `POST /api/dataset/:datasetId/convert-annotations-to-labels`
  - Backend converts annotations to YOLO format
  - Backend creates `.txt` label files (one per image)
  - **CRITICAL**: Backend sets `hasLabels = true` for all converted images
  - Converted images will no longer appear in unlabeled-images query

### 6. Training
- User returns to training view and initiates training
- Backend training process:
  - Automatically detects `.txt` label files in dataset folder
  - Uses images that have corresponding label files
  - Excludes images without label files
  - Trains model using YOLO format labels

### 7. Model Weights Download
- After training completes, frontend displays model info
- Frontend → Backend: `GET /api/models/:modelId/download-url?format=pt`
  - Backend generates signed URL with expiration
- Frontend downloads model weights (.pt, .onnx, or .zip)

**Key Constraint**: Annotations can ONLY be created/updated for images with `hasLabels = false`. After YOLO conversion, images are marked as labeled and excluded from annotation workflow.

---

## Authentication & Authorization

**MUST HAVE**:
- All endpoints require Bearer token authentication: `Authorization: Bearer <supabase_session_token>`
- Extract user ID from Supabase session token
- Users can only access datasets from their company/organization
- Return `401 Unauthorized` if token is invalid or expired
- Return `403 Forbidden` if user lacks access to the dataset

**Base URL**: Configured via `VITE_API_BASE_URL` environment variable (e.g., `http://localhost:3000/api`)

---

## Required API Endpoints

### Group 1: Image Management

#### 1.1 Get Unlabeled Images
**MUST HAVE**

**Endpoint**: `GET /api/dataset/:datasetId/unlabeled-images`

**Purpose**: Retrieve images that have no corresponding label files for annotation.

**URL Parameters**:
- `datasetId` (string, required)

**Query Parameters**:
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 50)

**Response**:
```json
{
  "images": [
    {
      "id": "507f1f77bcf86cd799439012",
      "filename": "image_001.jpg",
      "url": "https://storage.example.com/datasets/.../image_001.jpg",
      "thumbnailUrl": "https://storage.example.com/datasets/.../thumbnails/image_001.jpg",
      "folder": "unlabeled",
      "size": 245678
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

**Backend Requirements**:
- Filter images where `hasLabels = false` or no corresponding `.txt` label file exists
- Return signed URLs for `url` and `thumbnailUrl` (if available)
- Support pagination
- Return accurate `total` count for progress calculation
- Validate `datasetId` exists and user has access

**Validation**:
- `datasetId` must exist in database
- User must have access to dataset's company/organization

---

### Group 2: Annotation CRUD

#### 2.1 Get Annotations
**MUST HAVE**

**Endpoint**: `GET /api/dataset/:datasetId/annotations`

**Purpose**: Retrieve annotations for a dataset or specific image.

**URL Parameters**:
- `datasetId` (string, required)

**Query Parameters**:
- `imageId` (string, optional) - Filter by specific image

**Response**:
```json
{
  "annotations": [
    {
      "id": "507f1f77bcf86cd799439020",
      "imageId": "507f1f77bcf86cd799439012",
      "bbox": [0.25, 0.30, 0.15, 0.20],
      "categoryId": "507f1f77bcf86cd799439015",
      "categoryName": "Defect",
      "state": "draft",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "createdBy": "user_id_123",
      "updatedBy": "user_id_123",
      "reviewedBy": null,
      "reviewedAt": null,
      "approvedBy": null,
      "approvedAt": null
    }
  ],
  "total": 1
}
```

**Backend Requirements**:
- Return annotations with normalized bbox `[x, y, width, height]` (0-1 range)
- Include `categoryName` (denormalized from `categoryId` for performance)
- Support filtering by `imageId` (if provided)
- Include all metadata fields (timestamps, user IDs, state)
- If `imageId` not provided, return all annotations for dataset

**Validation**:
- `datasetId` must exist
- `imageId` must exist (if provided)
- User must have access to dataset

---

#### 2.2 Save Annotation
**MUST HAVE**

**Endpoint**: `POST /api/dataset/:datasetId/annotations`

**Purpose**: Create a new annotation.

**Request Body**:
```json
{
  "imageId": "507f1f77bcf86cd799439012",
  "bbox": [0.25, 0.30, 0.15, 0.20],
  "categoryId": "507f1f77bcf86cd799439015"
}
```

**Response**:
```json
{
  "annotation": {
    "id": "507f1f77bcf86cd799439020",
    "imageId": "507f1f77bcf86cd799439012",
    "bbox": [0.25, 0.30, 0.15, 0.20],
    "categoryId": "507f1f77bcf86cd799439015",
    "categoryName": "Defect",
    "state": "draft",
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": "user_id_123"
  },
  "message": "Annotation saved successfully"
}
```

**Backend Requirements**:
- Validate bbox coordinates are in 0-1 range
- Validate bbox dimensions are positive (width > 0, height > 0)
- Validate `categoryId` exists in dataset
- Validate `imageId` belongs to dataset
- Generate unique annotation ID
- Store `createdBy` from auth token
- Denormalize and include `categoryName` in response
- Set default `state` to "draft"
- Set `createdAt` and `updatedAt` timestamps

**Validation Rules**:
- `bbox[0]` (x): 0 ≤ x ≤ 1
- `bbox[1]` (y): 0 ≤ y ≤ 1
- `bbox[2]` (width): 0 < width ≤ 1
- `bbox[3]` (height): 0 < height ≤ 1
- `bbox[0] + bbox[2]` ≤ 1 (box doesn't exceed image width)
- `bbox[1] + bbox[3]` ≤ 1 (box doesn't exceed image height)
- `categoryId` must exist in categories table for this dataset
- `imageId` must exist in images table for this dataset
- **CRITICAL**: Image must have `hasLabels = false` (image must be unlabeled)
  - Annotations can only be created for unlabeled images
  - This prevents annotation of images that already have label files

**Error Responses**:
- `400 Bad Request`: Invalid bbox coordinates, missing required fields, or image already has labels
- `404 Not Found`: Category or image not found
- `403 Forbidden`: User lacks access to dataset

---

#### 2.3 Update Annotation
**MUST HAVE**

**Endpoint**: `PUT /api/dataset/:datasetId/annotations/:annotationId`

**Purpose**: Update an existing annotation (bbox, category, or state).

**Request Body** (all fields optional, but at least one required):
```json
{
  "bbox": [0.26, 0.31, 0.16, 0.21],
  "categoryId": "507f1f77bcf86cd799439016"
}
```

**Response**:
```json
{
  "annotation": {
    "id": "507f1f77bcf86cd799439020",
    "imageId": "507f1f77bcf86cd799439012",
    "bbox": [0.26, 0.31, 0.16, 0.21],
    "categoryId": "507f1f77bcf86cd799439016",
    "categoryName": "Good",
    "updatedAt": "2024-01-15T11:00:00Z",
    "updatedBy": "user_id_123"
  },
  "message": "Annotation updated"
}
```

**Backend Requirements**:
- Validate annotation exists
- Validate bbox if provided (same rules as Save Annotation)
- Validate categoryId if provided
- Update `categoryName` if `categoryId` changes
- Update `updatedAt` timestamp
- Store `updatedBy` from auth token
- Return updated annotation with all fields

**Validation**:
- Same bbox validation rules as Save Annotation
- `categoryId` must exist (if provided)
- Annotation must belong to dataset
- **CRITICAL**: Associated image must have `hasLabels = false` (image must be unlabeled)
  - Updates are only allowed for annotations on unlabeled images
  - This prevents modification of annotations for images that already have label files

---

#### 2.4 Delete Annotation
**MUST HAVE**

**Endpoint**: `DELETE /api/dataset/:datasetId/annotations/:annotationId`

**Response**:
```json
{
  "message": "Annotation deleted",
  "annotationId": "507f1f77bcf86cd799439020"
}
```

**Backend Requirements**:
- Validate annotation exists
- Validate annotation belongs to dataset
- Soft delete (recommended) or hard delete based on business logic
- Return 404 if annotation not found

---

#### 2.5 Batch Save Annotations
**MUST HAVE**

**Endpoint**: `POST /api/dataset/:datasetId/annotations/batch`

**Purpose**: Save multiple annotations atomically (used for auto-save).

**Request Body**:
```json
{
  "annotations": [
    {
      "imageId": "507f1f77bcf86cd799439012",
      "bbox": [0.25, 0.30, 0.15, 0.20],
      "categoryId": "507f1f77bcf86cd799439015"
    }
  ]
}
```

**Response**:
```json
{
  "saved": 2,
  "failed": 0,
  "errors": []
}
```

**Or with partial failures**:
```json
{
  "saved": 1,
  "failed": 1,
  "errors": [
    {
      "imageId": "507f1f77bcf86cd799439013",
      "error": "Invalid categoryId"
    }
  ]
}
```

**Backend Requirements**:
- Process annotations in a database transaction (atomicity)
- Validate each annotation individually
- Continue processing even if some fail
- Return detailed results (saved count, failed count, errors)
- Use rollback on complete failure (or validate all before saving)
- Apply same validation rules as Save Annotation for each item
- **CRITICAL**: Validate ALL images in batch have `hasLabels = false`
  - Reject individual annotations for images that already have labels
  - Continue processing annotations for unlabeled images
  - Return error details for each failed annotation in the `errors` array
  - Example error: `{ "imageId": "xxx", "error": "Image already has labels" }`

**Critical**: This endpoint is called frequently by the frontend auto-save mechanism. Performance is critical.

---

#### 2.6 Update Annotation State
**MUST HAVE** (Phase 6)

**Endpoint**: `PUT /api/dataset/:datasetId/annotations/:annotationId/state`

**Purpose**: Update annotation review state (draft → reviewed → approved/rejected).

**Request Body**:
```json
{
  "state": "approved",
  "userId": "user_id_123"
}
```

**Response**:
```json
{
  "annotation": {
    "id": "507f1f77bcf86cd799439020",
    "state": "approved",
    "approvedBy": "user_id_123",
    "approvedAt": "2024-01-15T12:00:00Z"
  },
  "message": "State updated"
}
```

**Backend Requirements**:
- Validate state is one of: "draft", "reviewed", "approved", "rejected"
- Validate state transitions (e.g., draft → reviewed → approved)
- Store `reviewedBy`/`approvedBy` and timestamps based on state
- Update `updatedAt` timestamp

**State Transitions**:
- `draft` → `reviewed` → `approved` (typical flow)
- `draft` → `reviewed` → `rejected` (rejection flow)
- `approved` → `reviewed` (downgrade allowed)
- `rejected` → `reviewed` (re-review allowed)

---

#### 2.7 Bulk Update Annotation State
**MUST HAVE** (Phase 6)

**Endpoint**: `PUT /api/dataset/:datasetId/annotations/bulk-state`

**Purpose**: Update state for multiple annotations at once.

**Request Body**:
```json
{
  "annotationIds": ["id1", "id2", "id3"],
  "state": "approved",
  "userId": "user_id_123"
}
```

**Response**:
```json
{
  "updated": 3,
  "failed": 0,
  "message": "State updated"
}
```

**Backend Requirements**:
- Process in transaction
- Validate all annotation IDs exist
- Apply same state transition rules as single update
- Return count of updated annotations

---

### Group 3: Category Management

#### 3.1 Get Categories
**MUST HAVE**

**Endpoint**: `GET /api/dataset/:datasetId/categories`

**Response**:
```json
{
  "categories": [
    {
      "id": "507f1f77bcf86cd799439015",
      "name": "Defect",
      "color": "#ef4444",
      "description": "Defective items",
      "createdAt": "2024-01-10T08:00:00Z",
      "annotationCount": 45
    }
  ]
}
```

**Backend Requirements**:
- Return categories ordered by creation date or custom `order` field
- Include `annotationCount` (number of annotations using this category)
- Ensure default categories exist if dataset is new: "Defect", "Good", "Unknown"
- Categories are dataset-specific (not global)

---

#### 3.2 Create Category
**MUST HAVE**

**Endpoint**: `POST /api/dataset/:datasetId/categories`

**Request Body**:
```json
{
  "name": "Scratch",
  "color": "#f59e0b",
  "description": "Items with scratches"
}
```

**Response**:
```json
{
  "category": {
    "id": "507f1f77bcf86cd799439017",
    "name": "Scratch",
    "color": "#f59e0b",
    "description": "Items with scratches",
    "createdAt": "2024-01-15T12:00:00Z"
  }
}
```

**Backend Requirements**:
- Validate name is unique within dataset
- Validate color is valid hex code (format: `#RRGGBB`)
- Generate unique category ID
- Store `createdBy` from auth token
- Prevent duplicate category names

**Validation**:
- `name`: Non-empty string, unique within dataset
- `color`: Valid hex color code (e.g., `#ef4444`)
- `description`: Optional string

---

#### 3.3 Update Category
**MUST HAVE**

**Endpoint**: `PUT /api/dataset/:datasetId/categories/:categoryId`

**Request Body** (all optional, but at least one required):
```json
{
  "name": "Deep Scratch",
  "color": "#dc2626",
  "description": "Items with deep scratches"
}
```

**Response**:
```json
{
  "category": {
    "id": "507f1f77bcf86cd799439017",
    "name": "Deep Scratch",
    "color": "#dc2626",
    "description": "Items with deep scratches",
    "updatedAt": "2024-01-15T13:00:00Z"
  },
  "message": "Category updated successfully"
}
```

**Backend Requirements**:
- Validate category exists
- Validate name uniqueness if name is changed
- Validate color format if color is changed
- **CRITICAL**: Update `categoryName` field in ALL annotations using this category
- Update `updatedAt` timestamp

**Critical Behavior**: When category name changes, all annotations with this `categoryId` must have their `categoryName` field updated. This is denormalized data that must stay in sync.

---

#### 3.4 Delete Category
**MUST HAVE**

**Endpoint**: `DELETE /api/dataset/:datasetId/categories/:categoryId`

**Query Parameters**:
- `reassignTo` (string, optional) - Category ID to reassign annotations to

**Response**:
```json
{
  "message": "Category deleted successfully",
  "reassignedCount": 12
}
```

**Backend Requirements**:
- Validate category exists
- Validate `reassignTo` category exists (if provided)
- **CRITICAL**: If `reassignTo` provided, reassign ALL annotations using this category
- Update `categoryId` and `categoryName` in all reassigned annotations
- Return count of reassigned annotations
- Prevent deletion if category has annotations and `reassignTo` not provided (or allow with confirmation)

---

#### 3.5 Reorder Categories
**MUST HAVE**

**Endpoint**: `PUT /api/dataset/:datasetId/categories/reorder`

**Request Body**:
```json
{
  "categoryIds": [
    "507f1f77bcf86cd799439015",
    "507f1f77bcf86cd799439016",
    "507f1f77bcf86cd799439017"
  ]
}
```

**Response**:
```json
{
  "message": "Categories reordered successfully"
}
```

**Backend Requirements**:
- Validate all categoryIds exist and belong to dataset
- Update display order (store `order` field or use array index)
- Preserve categories not in list (append to end)
- Validate all IDs are valid

---

### Group 4: YOLO Conversion

#### 4.1 Convert Annotations to YOLO Labels
**MUST HAVE**

**Endpoint**: `POST /api/dataset/:datasetId/convert-annotations-to-labels`

**Purpose**: Convert annotations to YOLO format label files for training.

**Request Body** (all optional):
```json
{
  "imageIds": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"],
  "folder": "train"
}
```

**Or convert all**:
```json
{}
```

**Response**:
```json
{
  "converted": 25,
  "labelFilesCreated": 25,
  "message": "Annotations converted to YOLO label format"
}
```

**Backend Requirements**:
- Convert normalized bbox `[x, y, width, height]` to YOLO format `[center_x, center_y, width, height]`
- Map `categoryId` to `class_id` (sequential index starting from 0, based on category order)
- Create `.txt` label files (one per image)
- Save label files in same folder structure as images
- Handle case where `imageIds` specified (only those images) or empty (all images)
- Validate all `imageIds` exist
- Create label files even if image has no annotations (empty file)
- **CRITICAL**: After creating label files, set `hasLabels = true` for all converted images
  - This marks images as labeled and prevents them from appearing in unlabeled-images query
  - This prevents re-annotation of images that already have label files
  - Update the `hasLabels` field in the images table/collection for all processed images

**YOLO Format Conversion**:
- Input: `bbox = [x, y, width, height]` (normalized 0-1)
- Output: `class_id center_x center_y width height` (all normalized 0-1)
- `center_x = x + width / 2`
- `center_y = y + height / 2`
- `width = width` (unchanged)
- `height = height` (unchanged)
- `class_id = index of category in ordered category list (0-based)`

**Example**:
- Category order: ["Defect", "Good", "Unknown"]
- Annotation with category "Good" → `class_id = 1`
- Bbox `[0.25, 0.30, 0.15, 0.20]` → `1 0.325 0.40 0.15 0.20`

**Label File Format**:
- One line per annotation
- Format: `class_id center_x center_y width height`
- All values space-separated, normalized 0-1
- File name: `{image_filename_without_extension}.txt`

**Critical**: This conversion must be accurate. Incorrect YOLO format will break model training.

---

### Group 5: Export/Import (Phase 6)

#### 5.1 Export Annotations
**NICE TO HAVE** (Phase 6)

**Endpoint**: `GET /api/dataset/:datasetId/export-annotations`

**Query Parameters**:
- `format` (string, required) - "yolo", "coco", or "json"
- `imageIds` (string, optional) - Comma-separated image IDs to export

**Response**: File download (Content-Type based on format)

**Backend Requirements**:
- Support YOLO format export (same as conversion)
- Support COCO JSON format (if implemented)
- Support custom JSON format
- Generate downloadable file
- Return signed URL or direct file stream

---

#### 5.2 Import Annotations
**NICE TO HAVE** (Phase 6)

**Endpoint**: `POST /api/dataset/:datasetId/import-annotations`

**Request**: `multipart/form-data`
- `file` (File, required) - Annotation file
- `format` (string, required) - "yolo", "coco", or "json"

**Response**:
```json
{
  "imported": 50,
  "failed": 2,
  "errors": [
    {
      "line": 15,
      "error": "Invalid bbox coordinates"
    }
  ]
}
```

**Backend Requirements**:
- Parse file based on format
- Validate all annotations before importing
- Map category names to category IDs
- Return detailed import results
- Support partial import (skip invalid entries)

---

### Group 6: Model Download

#### 6.1 Get Model Download URL
**MUST HAVE**

**Endpoint**: `GET /api/models/:modelId/download-url`

**Query Parameters**:
- `format` (string, required) - "pt", "onnx", or "zip"

**Response**:
```json
{
  "downloadUrl": "https://storage.example.com/models/.../model.pt?signature=...",
  "expiresAt": "2024-01-15T14:00:00Z",
  "fileSize": 52428800
}
```

**Backend Requirements**:
- Generate signed URL with expiration (typically 1 hour)
- Validate model exists and user has access
- Return file size for progress indication
- Support multiple formats (.pt, .onnx, .zip)
- Validate format is available for model
- Signed URL should be accessible without additional auth

---

#### 6.2 Get Model Info
**MUST HAVE**

**Endpoint**: `GET /api/models/:modelId`

**Response**:
```json
{
  "id": "507f1f77bcf86cd799439030",
  "name": "yolo_v8_model_v1",
  "format": "pt",
  "size": 52428800,
  "createdAt": "2024-01-15T10:00:00Z",
  "availableFormats": ["pt", "onnx", "zip"]
}
```

**Backend Requirements**:
- Validate model exists and user has access
- Return available formats for download
- Include file sizes for each format

---

## Database Schema Assumptions

### Annotations Table/Collection

```typescript
{
  _id: ObjectId,
  datasetId: ObjectId,                    // REQUIRED: Foreign key to datasets
  imageId: ObjectId,                     // REQUIRED: Foreign key to images
  bbox: [number, number, number, number], // REQUIRED: [x, y, width, height] normalized 0-1
  categoryId: ObjectId,                   // REQUIRED: Foreign key to categories
  categoryName: string,                  // REQUIRED: Denormalized for performance
  state: string,                         // OPTIONAL: "draft" | "reviewed" | "approved" | "rejected"
  createdAt: Date,                        // REQUIRED
  updatedAt: Date,                        // REQUIRED
  createdBy: ObjectId,                     // REQUIRED: User ID from auth token
  updatedBy: ObjectId,                    // OPTIONAL
  reviewedBy: ObjectId,                   // OPTIONAL
  reviewedAt: Date,                       // OPTIONAL
  approvedBy: ObjectId,                   // OPTIONAL
  approvedAt: Date,                       // OPTIONAL
  deletedAt: Date?                        // OPTIONAL: Soft delete
}
```

**Indexes** (MUST HAVE):
- `datasetId` (for filtering)
- `imageId` (for filtering)
- `categoryId` (for filtering)
- `datasetId + imageId` (composite, for common queries)
- `createdAt` (for sorting)

---

### Categories Table/Collection

```typescript
{
  _id: ObjectId,
  datasetId: ObjectId,     // REQUIRED: Foreign key to datasets
  name: string,            // REQUIRED: Unique within dataset
  color: string,           // REQUIRED: Hex color code
  description: string?,    // OPTIONAL
  order: number,           // REQUIRED: Display order
  createdAt: Date,         // REQUIRED
  updatedAt: Date,         // REQUIRED
  createdBy: ObjectId      // REQUIRED: User ID from auth token
}
```

**Indexes** (MUST HAVE):
- `datasetId` (for filtering)
- `datasetId + name` (composite, for uniqueness check)
- `datasetId + order` (composite, for sorting)

---

### Images Table/Collection

```typescript
{
  _id: ObjectId,
  datasetId: ObjectId,    // REQUIRED: Foreign key to datasets
  filename: string,       // REQUIRED
  storedPath: string,     // REQUIRED: Storage path
  folder: string?,        // OPTIONAL
  size: number,           // OPTIONAL: File size in bytes
  hasLabels: boolean,     // REQUIRED: For filtering unlabeled images
  createdAt: Date         // REQUIRED
}
```

**Indexes** (MUST HAVE):
- `datasetId` (for filtering)
- `datasetId + hasLabels` (composite, for unlabeled image queries)
- `datasetId + folder` (composite, if folder filtering needed)

---

## Validation Rules

### Bounding Box Validation

**MUST ENFORCE**:
1. All values must be numbers
2. `x` (bbox[0]): `0 ≤ x ≤ 1`
3. `y` (bbox[1]): `0 ≤ y ≤ 1`
4. `width` (bbox[2]): `0 < width ≤ 1`
5. `height` (bbox[3]): `0 < height ≤ 1`
6. `x + width ≤ 1` (box doesn't exceed image width)
7. `y + height ≤ 1` (box doesn't exceed image height)

**Error Response**: `400 Bad Request` with message: "Invalid bbox coordinates: values must be between 0 and 1, and box must fit within image bounds"

---

### Category Validation

**MUST ENFORCE**:
1. `name`: Non-empty string, unique within dataset
2. `color`: Valid hex color code format `#RRGGBB` (6 hex digits)
3. Category must belong to the dataset

**Error Response**: `400 Bad Request` with message: "Category name must be unique within dataset" or "Invalid color format"

---

### Dataset Scoping

**MUST ENFORCE**:
1. All annotations must belong to the dataset specified in URL
2. All categories must belong to the dataset
3. All images must belong to the dataset
4. User must have access to dataset's company/organization

**Error Response**: `403 Forbidden` or `404 Not Found`

---

### State Transition Validation

**MUST ENFORCE** (Phase 6):
1. Valid states: "draft", "reviewed", "approved", "rejected"
2. State transitions should follow logical flow:
   - `draft` → `reviewed` → `approved` (typical)
   - `draft` → `reviewed` → `rejected` (rejection)
   - `approved` → `reviewed` (downgrade allowed)
   - `rejected` → `reviewed` (re-review allowed)

**Error Response**: `400 Bad Request` with message: "Invalid state transition"

---

## Critical Behaviors

### 1. Denormalization (Category Name)

**CRITICAL**: The `categoryName` field in annotations must be kept in sync with the category table.

**When to Update**:
- When category name changes → Update ALL annotations with that `categoryId`
- When category is deleted and reassigned → Update `categoryId` AND `categoryName` in all affected annotations

**Why**: Frontend relies on `categoryName` being present in annotation responses for performance. Missing or stale `categoryName` will break the UI.

---

### 2. Batch Save Performance

**CRITICAL**: The batch save endpoint is called frequently by auto-save (every 2 seconds when annotations change).

**Requirements**:
- Must complete within 500ms for typical batch sizes (1-10 annotations)
- Use database transactions for atomicity
- Consider batching database writes
- Index on `datasetId` and `imageId` is essential

**Optimization Tips**:
- Use bulk insert/update operations
- Validate all annotations before starting transaction
- Consider async processing for large batches (if acceptable)

---

### 3. YOLO Conversion Accuracy

**CRITICAL**: Incorrect YOLO format will break model training.

**Requirements**:
- Bbox conversion must be mathematically correct
- `class_id` mapping must match category order exactly
- Label files must be saved in correct location (same folder as images)
- Empty label files must be created for images with no annotations

**Validation**:
- Verify bbox coordinates are normalized 0-1 after conversion
- Verify `class_id` is within valid range (0 to category_count - 1)
- Verify label file format matches YOLO spec exactly

---

### 4. Signed URL Generation

**CRITICAL**: Image URLs and download URLs must be accessible.

**Requirements**:
- Generate signed URLs with appropriate expiration (1 hour recommended)
- URLs must work without additional authentication
- Handle URL expiration gracefully (frontend will retry)

---

## Performance & Indexing

### Required Indexes

**Annotations**:
- `datasetId` (single)
- `imageId` (single)
- `datasetId + imageId` (composite) - **CRITICAL** for common queries
- `categoryId` (single)
- `createdAt` (for sorting)

**Categories**:
- `datasetId` (single)
- `datasetId + name` (composite) - **CRITICAL** for uniqueness
- `datasetId + order` (composite) - for sorting

**Images**:
- `datasetId` (single)
- `datasetId + hasLabels` (composite) - **CRITICAL** for unlabeled image queries

### Query Optimization

1. **Unlabeled Images Query**: Use `hasLabels = false` index
2. **Annotations by Image**: Use `datasetId + imageId` composite index
3. **Category Lookups**: Cache category data (they change infrequently)

### Caching Recommendations

**NICE TO HAVE**:
- Cache category data (TTL: 5 minutes)
- Cache dataset access permissions (TTL: 1 minute)
- Consider Redis for session validation

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error type",
  "message": "Human-readable error message"
}
```

### HTTP Status Codes

- `200 OK`: Success
- `400 Bad Request`: Invalid input (bbox, category, etc.)
- `401 Unauthorized`: Invalid or expired token
- `403 Forbidden`: User lacks access to resource
- `404 Not Found`: Resource not found (annotation, category, image, dataset)
- `500 Internal Server Error`: Server error

### Error Messages

**MUST BE DESCRIPTIVE**:
- "Invalid bbox coordinates: x must be between 0 and 1"
- "Category 'Defect' already exists in this dataset"
- "Image not found in dataset"
- "Annotation not found"

**AVOID**:
- Generic messages like "Error" or "Failed"
- Technical stack traces in production

---

## Backend Ready Checklist

### MUST HAVE (Core Functionality)

- [ ] All 6 annotation CRUD endpoints implemented
- [ ] All 5 category management endpoints implemented
- [ ] YOLO conversion endpoint implemented
- [ ] Model download endpoints implemented
- [ ] Bearer token authentication working
- [ ] Dataset scoping enforced (users can only access their datasets)
- [ ] Bbox validation implemented (0-1 range, positive dimensions, within bounds)
- [ ] Category name denormalization working (stays in sync)
- [ ] Batch save endpoint optimized (< 500ms)
- [ ] Required database indexes created
- [ ] Error responses follow standard format
- [ ] Signed URLs generated for images

### MUST HAVE (Phase 6 - Advanced Features)

- [ ] Annotation state management endpoints (single + bulk)
- [ ] State transition validation
- [ ] Metadata fields (createdBy, updatedBy, timestamps) stored and returned

### NICE TO HAVE (Phase 6 - Optional)

- [ ] Export annotations endpoint (YOLO, COCO, JSON)
- [ ] Import annotations endpoint with validation
- [ ] Annotator performance stats endpoint
- [ ] Conflict detection support (If-Modified-Since header)

### Testing Recommendations

1. **Unit Tests**:
   - Bbox validation (edge cases: 0, 1, negative, > 1)
   - Category name denormalization sync
   - YOLO conversion accuracy
   - State transition validation

2. **Integration Tests**:
   - Full annotation workflow (create → update → delete)
   - Batch save with partial failures
   - Category update affecting annotations
   - YOLO conversion with multiple categories

3. **Performance Tests**:
   - Batch save with 10, 50, 100 annotations
   - Unlabeled images query with pagination
   - Category lookup with caching

---

## Notes for Backend Team

1. **Frontend Dependency**: The frontend is fully implemented and depends on these exact API contracts. Any deviation will break the UI.

2. **Normalized Coordinates**: All bbox coordinates are normalized 0-1. The backend should NOT convert to pixel coordinates. The frontend handles display scaling.

3. **Denormalization**: `categoryName` in annotations is denormalized for performance. It MUST be kept in sync with the categories table.

4. **Auto-Save Frequency**: Batch save is called every 2 seconds when annotations change. Ensure this endpoint is optimized.

5. **YOLO Format**: The conversion must be mathematically correct. Test with known good/bad examples.

6. **Signed URLs**: Image and download URLs must be accessible without additional auth. Use your storage provider's signed URL feature.

7. **Error Messages**: Frontend displays error messages to users. Make them descriptive and user-friendly.

8. **Unlabeled Data Only**: Annotations can ONLY be created/updated for images with `hasLabels = false`. This is a critical validation that prevents annotation of already-labeled images. The Save Annotation, Update Annotation, and Batch Save endpoints must enforce this rule.

9. **Post-Conversion State**: After YOLO conversion creates label files, images must be marked as labeled (`hasLabels = true`). This ensures converted images are excluded from unlabeled-images queries and prevents duplicate annotation. The YOLO conversion endpoint must update the `hasLabels` field for all processed images.

10. **Training Integration**: The training process should automatically detect and use `.txt` label files created by the YOLO conversion endpoint. Training should use images that have corresponding label files and exclude images without label files. This integration may be handled by the training service, but the label files must be available in the expected location (same folder structure as images).

---

**Document Version**: 1.0  
**Last Updated**: Based on Phase 1-6 implementation  
**Frontend Status**: Fully implemented, awaiting backend APIs

