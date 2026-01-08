# Annotation API Endpoints Reference

This document details all API endpoints assumed for the annotation system, including request/response formats and required backend information.

---

## Base URL

All endpoints are relative to: `VITE_API_BASE_URL` (e.g., `http://localhost:3000/api`)

**Authentication**: All endpoints require Bearer token authentication:
```
Authorization: Bearer <supabase_session_token>
```

---

## 1. Annotation Endpoints

### 1.1 Get Unlabeled Images

**Endpoint**: `GET /api/dataset/:datasetId/unlabeled-images`

**Purpose**: Retrieve unlabeled images for annotation

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID

**Query Parameters**:
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 50)

**Request Example**:
```
GET /api/dataset/507f1f77bcf86cd799439011/unlabeled-images?page=1&limit=50
Authorization: Bearer <token>
```

**Response Format**:
```json
{
  "images": [
    {
      "id": "507f1f77bcf86cd799439012",
      "filename": "image_001.jpg",
      "url": "https://storage.example.com/datasets/507f1f77bcf86cd799439011/images/image_001.jpg",
      "thumbnailUrl": "https://storage.example.com/datasets/507f1f77bcf86cd799439011/thumbnails/image_001.jpg",
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
- Must filter images that have NO corresponding label files
- Must return signed URLs for `url` and `thumbnailUrl` (if available)
- Must support pagination
- Must return total count for progress calculation
- Image `id` should be unique identifier (MongoDB `_id` or equivalent)

**Response Fields**:
- `images[]` - Array of image objects
  - `id` (string, required) - Unique image identifier
  - `filename` (string, required) - Original filename
  - `url` (string, required) - Full-size image URL (signed/accessible)
  - `thumbnailUrl` (string, optional) - Thumbnail URL (signed/accessible)
  - `folder` (string, optional) - Folder path within dataset
  - `size` (number, optional) - File size in bytes
- `total` (number, required) - Total unlabeled images in dataset
- `page` (number, required) - Current page number
- `limit` (number, required) - Items per page
- `totalPages` (number, required) - Total number of pages

---

### 1.2 Get Annotations

**Endpoint**: `GET /api/dataset/:datasetId/annotations`

**Purpose**: Retrieve annotations for a dataset or specific image

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID

**Query Parameters**:
- `imageId` (string, optional) - Filter annotations by image ID

**Request Example**:
```
GET /api/dataset/507f1f77bcf86cd799439011/annotations?imageId=507f1f77bcf86cd799439012
Authorization: Bearer <token>
```

**Response Format**:
```json
{
  "annotations": [
    {
      "id": "507f1f77bcf86cd799439020",
      "imageId": "507f1f77bcf86cd799439012",
      "bbox": [0.25, 0.30, 0.15, 0.20],
      "categoryId": "507f1f77bcf86cd799439015",
      "categoryName": "Defect",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "createdBy": "user_id_123"
    }
  ],
  "total": 1
}
```

**Backend Requirements**:
- Must return annotations with normalized bbox coordinates [x, y, width, height] (0-1 range)
- Must include `categoryName` (denormalized from categoryId)
- Must support filtering by `imageId`
- Should include timestamps and creator info for audit trail
- If `imageId` not provided, return all annotations for dataset

**Response Fields**:
- `annotations[]` - Array of annotation objects
  - `id` (string, required) - Unique annotation identifier
  - `imageId` (string, required) - Associated image ID
  - `bbox` (array[4], required) - Normalized bounding box [x, y, width, height] (0-1)
  - `categoryId` (string, required) - Category identifier
  - `categoryName` (string, required) - Category name (denormalized)
  - `createdAt` (string, optional) - ISO 8601 timestamp
  - `updatedAt` (string, optional) - ISO 8601 timestamp
  - `createdBy` (string, optional) - User ID who created annotation
- `total` (number, required) - Total annotations matching query

---

### 1.3 Save Annotation

**Endpoint**: `POST /api/dataset/:datasetId/annotations`

**Purpose**: Create a new annotation

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID

**Request Body**:
```json
{
  "imageId": "507f1f77bcf86cd799439012",
  "bbox": [0.25, 0.30, 0.15, 0.20],
  "categoryId": "507f1f77bcf86cd799439015"
}
```

**Request Example**:
```
POST /api/dataset/507f1f77bcf86cd799439011/annotations
Authorization: Bearer <token>
Content-Type: application/json

{
  "imageId": "507f1f77bcf86cd799439012",
  "bbox": [0.25, 0.30, 0.15, 0.20],
  "categoryId": "507f1f77bcf86cd799439015"
}
```

**Response Format**:
```json
{
  "annotation": {
    "id": "507f1f77bcf86cd799439020",
    "imageId": "507f1f77bcf86cd799439012",
    "bbox": [0.25, 0.30, 0.15, 0.20],
    "categoryId": "507f1f77bcf86cd799439015",
    "categoryName": "Defect",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "Annotation saved successfully"
}
```

**Backend Requirements**:
- Must validate bbox coordinates are in 0-1 range
- Must validate categoryId exists
- Must denormalize and include `categoryName` in response
- Must generate unique annotation ID
- Must store `createdBy` from auth token
- Must validate imageId belongs to dataset
- Should validate bbox dimensions are positive

**Request Fields**:
- `imageId` (string, required) - Image identifier
- `bbox` (array[4], required) - Normalized bounding box [x, y, width, height] (0-1)
- `categoryId` (string, required) - Category identifier

**Response Fields**:
- `annotation` (object, required) - Created annotation with all fields
- `message` (string, required) - Success message

---

### 1.4 Update Annotation

**Endpoint**: `PUT /api/dataset/:datasetId/annotations/:annotationId`

**Purpose**: Update an existing annotation

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID
- `annotationId` (string, required) - Annotation ID

**Request Body**:
```json
{
  "bbox": [0.26, 0.31, 0.16, 0.21],
  "categoryId": "507f1f77bcf86cd799439016"
}
```

**Request Example**:
```
PUT /api/dataset/507f1f77bcf86cd799439011/annotations/507f1f77bcf86cd799439020
Authorization: Bearer <token>
Content-Type: application/json

{
  "bbox": [0.26, 0.31, 0.16, 0.21],
  "categoryId": "507f1f77bcf86cd799439016"
}
```

**Response Format**:
```json
{
  "annotation": {
    "id": "507f1f77bcf86cd799439020",
    "imageId": "507f1f77bcf86cd799439012",
    "bbox": [0.26, 0.31, 0.16, 0.21],
    "categoryId": "507f1f77bcf86cd799439016",
    "categoryName": "Good",
    "updatedAt": "2024-01-15T11:00:00Z"
  },
  "message": "Annotation updated"
}
```

**Backend Requirements**:
- Must validate annotation exists
- Must validate bbox if provided (0-1 range, positive dimensions)
- Must validate categoryId if provided
- Must update `categoryName` if categoryId changes
- Must update `updatedAt` timestamp
- Should track update history (optional)

**Request Fields** (all optional, but at least one required):
- `bbox` (array[4], optional) - Updated normalized bounding box
- `categoryId` (string, optional) - Updated category identifier

**Response Fields**:
- `annotation` (object, required) - Updated annotation
- `message` (string, required) - Success message

---

### 1.5 Delete Annotation

**Endpoint**: `DELETE /api/dataset/:datasetId/annotations/:annotationId`

**Purpose**: Delete an annotation

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID
- `annotationId` (string, required) - Annotation ID

**Request Example**:
```
DELETE /api/dataset/507f1f77bcf86cd799439011/annotations/507f1f77bcf86cd799439020
Authorization: Bearer <token>
```

**Response Format**:
```json
{
  "message": "Annotation deleted",
  "annotationId": "507f1f77bcf86cd799439020"
}
```

**Backend Requirements**:
- Must validate annotation exists
- Must validate annotation belongs to dataset
- Should soft delete (mark as deleted) or hard delete based on business logic
- Should return 404 if annotation not found

**Response Fields**:
- `message` (string, required) - Success message
- `annotationId` (string, required) - Deleted annotation ID

---

### 1.6 Batch Save Annotations

**Endpoint**: `POST /api/dataset/:datasetId/annotations/batch`

**Purpose**: Save multiple annotations in a single request (for auto-save)

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID

**Request Body**:
```json
{
  "annotations": [
    {
      "imageId": "507f1f77bcf86cd799439012",
      "bbox": [0.25, 0.30, 0.15, 0.20],
      "categoryId": "507f1f77bcf86cd799439015"
    },
    {
      "imageId": "507f1f77bcf86cd799439013",
      "bbox": [0.40, 0.50, 0.20, 0.25],
      "categoryId": "507f1f77bcf86cd799439016"
    }
  ]
}
```

**Request Example**:
```
POST /api/dataset/507f1f77bcf86cd799439011/annotations/batch
Authorization: Bearer <token>
Content-Type: application/json

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

**Response Format**:
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
- Must process annotations in batch (transaction recommended)
- Must validate each annotation individually
- Must continue processing even if some fail
- Must return detailed results (saved count, failed count, errors)
- Should use database transaction for atomicity
- Should validate all annotations before saving any (or use rollback on failure)

**Request Fields**:
- `annotations[]` (array, required) - Array of annotation objects
  - `imageId` (string, required) - Image identifier
  - `bbox` (array[4], required) - Normalized bounding box
  - `categoryId` (string, required) - Category identifier

**Response Fields**:
- `saved` (number, required) - Number of successfully saved annotations
- `failed` (number, required) - Number of failed annotations
- `errors[]` (array, optional) - Array of error objects (only if failed > 0)
  - `imageId` (string, required) - Image ID that failed
  - `error` (string, required) - Error message

---

## 2. Category Endpoints

### 2.1 Get Categories

**Endpoint**: `GET /api/dataset/:datasetId/categories`

**Purpose**: Retrieve all categories for a dataset

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID

**Request Example**:
```
GET /api/dataset/507f1f77bcf86cd799439011/categories
Authorization: Bearer <token>
```

**Response Format**:
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
    },
    {
      "id": "507f1f77bcf86cd799439016",
      "name": "Good",
      "color": "#22c55e",
      "description": "Good quality items",
      "createdAt": "2024-01-10T08:00:00Z",
      "annotationCount": 120
    }
  ]
}
```

**Backend Requirements**:
- Must return categories ordered by creation date or custom order
- Should include `annotationCount` (number of annotations using this category)
- Should ensure default categories exist (Defect, Good, Unknown) if dataset is new
- Categories are dataset-specific (not global)

**Response Fields**:
- `categories[]` (array, required) - Array of category objects
  - `id` (string, required) - Unique category identifier
  - `name` (string, required) - Category name
  - `color` (string, required) - Hex color code (e.g., "#ef4444")
  - `description` (string, optional) - Category description
  - `createdAt` (string, optional) - ISO 8601 timestamp
  - `annotationCount` (number, optional) - Count of annotations using this category

---

### 2.2 Create Category

**Endpoint**: `POST /api/dataset/:datasetId/categories`

**Purpose**: Create a new category

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID

**Request Body**:
```json
{
  "name": "Scratch",
  "color": "#f59e0b",
  "description": "Items with scratches"
}
```

**Request Example**:
```
POST /api/dataset/507f1f77bcf86cd799439011/categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Scratch",
  "color": "#f59e0b",
  "description": "Items with scratches"
}
```

**Response Format**:
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
- Must validate name is unique within dataset
- Must validate color is valid hex code
- Must generate unique category ID
- Must store `createdBy` from auth token
- Should prevent duplicate category names

**Request Fields**:
- `name` (string, required) - Category name (unique within dataset)
- `color` (string, required) - Hex color code (e.g., "#f59e0b")
- `description` (string, optional) - Category description

**Response Fields**:
- `category` (object, required) - Created category with all fields

---

### 2.3 Update Category

**Endpoint**: `PUT /api/dataset/:datasetId/categories/:categoryId`

**Purpose**: Update an existing category

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID
- `categoryId` (string, required) - Category ID

**Request Body**:
```json
{
  "name": "Deep Scratch",
  "color": "#dc2626",
  "description": "Items with deep scratches"
}
```

**Request Example**:
```
PUT /api/dataset/507f1f77bcf86cd799439011/categories/507f1f77bcf86cd799439017
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Deep Scratch",
  "color": "#dc2626"
}
```

**Response Format**:
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
- Must validate category exists
- Must validate name uniqueness if name is changed
- Must validate color format if color is changed
- Should update all annotations using this category's `categoryName` field
- Must update `updatedAt` timestamp

**Request Fields** (all optional, but at least one required):
- `name` (string, optional) - Updated category name
- `color` (string, optional) - Updated hex color code
- `description` (string, optional) - Updated description

**Response Fields**:
- `category` (object, required) - Updated category
- `message` (string, required) - Success message

---

### 2.4 Delete Category

**Endpoint**: `DELETE /api/dataset/:datasetId/categories/:categoryId`

**Purpose**: Delete a category (with optional reassignment)

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID
- `categoryId` (string, required) - Category ID

**Query Parameters**:
- `reassignTo` (string, optional) - Category ID to reassign annotations to

**Request Example**:
```
DELETE /api/dataset/507f1f77bcf86cd799439011/categories/507f1f77bcf86cd799439017?reassignTo=507f1f77bcf86cd799439015
Authorization: Bearer <token>
```

**Response Format**:
```json
{
  "message": "Category deleted successfully",
  "reassignedCount": 12
}
```

**Backend Requirements**:
- Must validate category exists
- Must validate `reassignTo` category exists if provided
- Must reassign all annotations using this category to `reassignTo` category if provided
- Must update `categoryName` in all reassigned annotations
- Should prevent deletion if category has annotations and `reassignTo` not provided (or allow with confirmation)
- Should return count of reassigned annotations
- Should return 404 if category not found

**Response Fields**:
- `message` (string, required) - Success message
- `reassignedCount` (number, optional) - Number of annotations reassigned (if reassignTo provided)

---

### 2.5 Reorder Categories

**Endpoint**: `PUT /api/dataset/:datasetId/categories/reorder`

**Purpose**: Change the display order of categories

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID

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

**Request Example**:
```
PUT /api/dataset/507f1f77bcf86cd799439011/categories/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "categoryIds": ["507f1f77bcf86cd799439015", "507f1f77bcf86cd799439016"]
}
```

**Response Format**:
```json
{
  "message": "Categories reordered successfully"
}
```

**Backend Requirements**:
- Must validate all categoryIds exist and belong to dataset
- Must update display order (store order field or use array index)
- Should preserve categories not in list (append to end)
- Should validate all IDs are valid

**Request Fields**:
- `categoryIds[]` (array, required) - Ordered array of category IDs

**Response Fields**:
- `message` (string, required) - Success message

---

## 3. Model/Conversion Endpoints

### 3.1 Convert Annotations to YOLO Labels

**Endpoint**: `POST /api/dataset/:datasetId/convert-annotations-to-labels`

**Purpose**: Convert annotations to YOLO format label files

**URL Parameters**:
- `datasetId` (string, required) - Dataset ID

**Request Body**:
```json
{
  "imageIds": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"],
  "folder": "train"
}
```

**Request Example**:
```
POST /api/dataset/507f1f77bcf86cd799439011/convert-annotations-to-labels
Authorization: Bearer <token>
Content-Type: application/json

{
  "imageIds": ["507f1f77bcf86cd799439012"]
}
```

**Or convert all**:
```json
{}
```

**Response Format**:
```json
{
  "converted": 25,
  "labelFilesCreated": 25,
  "message": "Annotations converted to YOLO label format"
}
```

**Backend Requirements**:
- Must convert normalized bbox [x, y, width, height] to YOLO format [center_x, center_y, width, height]
- Must map categoryId to class_id (sequential index starting from 0)
- Must create .txt label files (one per image)
- Must save label files in same folder structure as images
- Must handle case where imageIds specified (only those images) or empty (all images)
- Must validate all imageIds exist
- Must create label files even if image has no annotations (empty file)
- YOLO format: `class_id center_x center_y width height` (one line per annotation, normalized 0-1)
- Should return count of converted images and created label files

**Request Fields** (all optional):
- `imageIds[]` (array, optional) - Specific image IDs to convert (if omitted, convert all)
- `folder` (string, optional) - Specific folder to process

**Response Fields**:
- `converted` (number, required) - Number of images processed
- `labelFilesCreated` (number, required) - Number of label files created
- `message` (string, required) - Success message

**YOLO Format Details**:
- Each line: `class_id center_x center_y width height`
- All values normalized 0-1
- `center_x` = bbox[0] + bbox[2] / 2
- `center_y` = bbox[1] + bbox[3] / 2
- `width` = bbox[2]
- `height` = bbox[3]
- `class_id` = index of category in ordered category list

---

### 3.2 Get Model Download URL

**Endpoint**: `GET /api/models/:modelId/download-url`

**Purpose**: Get signed download URL for model file

**URL Parameters**:
- `modelId` (string, required) - Model ID

**Query Parameters**:
- `format` (string, required) - File format: "pt", "onnx", or "zip"

**Request Example**:
```
GET /api/models/507f1f77bcf86cd799439030/download-url?format=pt
Authorization: Bearer <token>
```

**Response Format**:
```json
{
  "downloadUrl": "https://storage.example.com/models/507f1f77bcf86cd799439030/model.pt?signature=...",
  "expiresAt": "2024-01-15T14:00:00Z",
  "fileSize": 52428800
}
```

**Backend Requirements**:
- Must generate signed URL with expiration (typically 1 hour)
- Must validate model exists and user has access
- Must return file size for progress indication
- Must support multiple formats (.pt, .onnx, .zip)
- Should validate format is available for model
- Signed URL should be accessible without additional auth

**Response Fields**:
- `downloadUrl` (string, required) - Signed URL for download (expires)
- `expiresAt` (string, required) - ISO 8601 timestamp when URL expires
- `fileSize` (number, required) - File size in bytes

---

### 3.3 Get Model Info

**Endpoint**: `GET /api/models/:modelId`

**Purpose**: Get model information

**URL Parameters**:
- `modelId` (string, required) - Model ID

**Request Example**:
```
GET /api/models/507f1f77bcf86cd799439030
Authorization: Bearer <token>
```

**Response Format**:
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
- Must validate model exists and user has access
- Must return available formats for download
- Should include file sizes for each format

**Response Fields**:
- `id` (string, required) - Model identifier
- `name` (string, required) - Model name/version
- `format` (string, required) - Primary format
- `size` (number, required) - Primary file size in bytes
- `createdAt` (string, required) - ISO 8601 timestamp
- `availableFormats[]` (array, required) - Available download formats

---

## 4. Error Responses

All endpoints should return appropriate HTTP status codes and error messages:

**400 Bad Request**:
```json
{
  "error": "Invalid bbox coordinates",
  "message": "Bbox values must be between 0 and 1"
}
```

**401 Unauthorized**:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**404 Not Found**:
```json
{
  "error": "Not found",
  "message": "Annotation not found"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## 5. Data Types Reference

### Bounding Box Format
- **Type**: `[number, number, number, number]`
- **Format**: `[x, y, width, height]`
- **Range**: All values normalized 0-1
- **Example**: `[0.25, 0.30, 0.15, 0.20]`
  - `x = 0.25` (25% from left)
  - `y = 0.30` (30% from top)
  - `width = 0.15` (15% of image width)
  - `height = 0.20` (20% of image height)

### Category Color Format
- **Type**: `string`
- **Format**: Hex color code
- **Example**: `"#ef4444"` (red), `"#22c55e"` (green)

### Timestamp Format
- **Type**: `string`
- **Format**: ISO 8601
- **Example**: `"2024-01-15T10:30:00Z"`

---

## 6. Backend Database Schema Assumptions

### Annotations Collection/Table
```typescript
{
  _id: ObjectId,
  datasetId: ObjectId,
  imageId: ObjectId,
  bbox: [number, number, number, number], // [x, y, width, height] normalized
  categoryId: ObjectId,
  categoryName: string, // Denormalized for performance
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId,
  deletedAt: Date? // Soft delete
}
```

### Categories Collection/Table
```typescript
{
  _id: ObjectId,
  datasetId: ObjectId,
  name: string,
  color: string, // Hex color
  description: string?,
  order: number, // Display order
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId
}
```

### Images Collection/Table
```typescript
{
  _id: ObjectId,
  datasetId: ObjectId,
  filename: string,
  storedPath: string,
  folder: string?,
  size: number,
  hasLabels: boolean, // For filtering unlabeled images
  createdAt: Date
}
```

---

## 7. Security Requirements

1. **Authentication**: All endpoints require valid Bearer token
2. **Authorization**: Users can only access datasets from their company
3. **Validation**: All input must be validated (bbox ranges, category existence, etc.)
4. **Rate Limiting**: Consider rate limiting for batch operations
5. **Data Sanitization**: Sanitize all user inputs
6. **Signed URLs**: Use signed URLs for file downloads with expiration

---

## 8. Performance Considerations

1. **Pagination**: Use pagination for large datasets
2. **Caching**: Cache category lookups
3. **Denormalization**: Store `categoryName` in annotations for faster reads
4. **Indexing**: Index on `datasetId`, `imageId`, `categoryId`
5. **Batch Operations**: Support batch saves for auto-save functionality

---

This document serves as the complete reference for all annotation-related API endpoints and their requirements.


