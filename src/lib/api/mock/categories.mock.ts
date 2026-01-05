import type { Category } from "@/types/annotation";
import { mockCategories } from "@/lib/mocks/annotationMocks";

// In-memory storage for mock categories
const mockCategoriesStorage: Record<string, Category[]> = {};

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Ensure default categories exist
const ensureDefaultCategories = (datasetId: string): void => {
  if (!mockCategoriesStorage[datasetId]) {
    mockCategoriesStorage[datasetId] = [...mockCategories];
  }

  // Ensure default categories exist
  const defaults = [
    { id: "defect", name: "Defect", color: "#ef4444" },
    { id: "good", name: "Good", color: "#22c55e" },
    { id: "unknown", name: "Unknown", color: "#6b7280" },
  ];

  defaults.forEach((defaultCat) => {
    const exists = mockCategoriesStorage[datasetId].some(
      (cat) => cat.id === defaultCat.id || cat.name === defaultCat.name
    );
    if (!exists) {
      mockCategoriesStorage[datasetId].push({
        ...defaultCat,
        id: `cat_${datasetId}_${defaultCat.id}_${Date.now()}`,
      });
    }
  });
};

/**
 * Get categories for a dataset
 * GET /api/dataset/:datasetId/categories
 */
export const getCategories = async (
  datasetId: string
): Promise<{
  categories: Category[];
}> => {
  await delay(150 + Math.random() * 200); // 150-350ms delay

  ensureDefaultCategories(datasetId);

  return {
    categories: mockCategoriesStorage[datasetId],
  };
};

/**
 * Create a new category
 * POST /api/dataset/:datasetId/categories
 */
export const createCategory = async (
  datasetId: string,
  data: {
    name: string;
    color: string;
    description?: string;
  }
): Promise<{
  category: Category;
}> => {
  await delay(200 + Math.random() * 300); // 200-500ms delay

  ensureDefaultCategories(datasetId);

  const newCategory: Category = {
    id: `cat_${datasetId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: data.name,
    color: data.color,
    description: data.description,
  };

  mockCategoriesStorage[datasetId].push(newCategory);

  return {
    category: newCategory,
  };
};

/**
 * Update a category
 * PUT /api/dataset/:datasetId/categories/:categoryId
 */
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
}> => {
  await delay(200 + Math.random() * 300); // 200-500ms delay

  ensureDefaultCategories(datasetId);

  const categories = mockCategoriesStorage[datasetId];
  const index = categories.findIndex((cat) => cat.id === categoryId);

  if (index === -1) {
    throw new Error("Category not found");
  }

  const updated: Category = {
    ...categories[index],
    ...(data.name && { name: data.name }),
    ...(data.color && { color: data.color }),
    ...(data.description !== undefined && { description: data.description }),
  };

  categories[index] = updated;
  mockCategoriesStorage[datasetId] = categories;

  return {
    category: updated,
    message: "Category updated successfully",
  };
};

/**
 * Delete a category
 * DELETE /api/dataset/:datasetId/categories/:categoryId
 */
export const deleteCategory = async (
  datasetId: string,
  categoryId: string,
  reassignTo?: string
): Promise<{
  message: string;
  reassignedCount?: number;
}> => {
  await delay(200 + Math.random() * 300); // 200-500ms delay

  ensureDefaultCategories(datasetId);

  const categories = mockCategoriesStorage[datasetId];
  const index = categories.findIndex((cat) => cat.id === categoryId);

  if (index === -1) {
    throw new Error("Category not found");
  }

  // Check if it's a default category (prevent deletion of defaults)
  const category = categories[index];
  const isDefault = ["Defect", "Good", "Unknown"].includes(category.name);

  if (isDefault && !reassignTo) {
    throw new Error("Cannot delete default category without reassignment");
  }

  // Reassign annotations if needed (mock - in real API this would update annotations)
  let reassignedCount = 0;
  if (reassignTo) {
    // Mock: just return a count (real API would update annotations)
    reassignedCount = 0; // Would be calculated from actual annotations
  }

  // Remove category
  categories.splice(index, 1);
  mockCategoriesStorage[datasetId] = categories;

  return {
    message: "Category deleted successfully",
    reassignedCount,
  };
};

/**
 * Reorder categories
 * PUT /api/dataset/:datasetId/categories/reorder
 */
export const reorderCategories = async (
  datasetId: string,
  categoryIds: string[]
): Promise<{
  message: string;
}> => {
  await delay(150 + Math.random() * 200); // 150-350ms delay

  ensureDefaultCategories(datasetId);

  const categories = mockCategoriesStorage[datasetId];
  const reordered = categoryIds
    .map((id) => categories.find((cat) => cat.id === id))
    .filter((cat): cat is Category => cat !== undefined);

  // Add any categories not in the reorder list at the end
  const remaining = categories.filter((cat) => !categoryIds.includes(cat.id));
  mockCategoriesStorage[datasetId] = [...reordered, ...remaining];

  return {
    message: "Categories reordered successfully",
  };
};

