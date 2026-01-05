import React from "react";
import type { Category } from "@/types/annotation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface CategorySelectorProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onCategorySelect?: (categoryId: string) => void;
  onAddCategory?: () => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  selectedCategoryId,
  onCategorySelect,
  onAddCategory,
}) => {
  return (
    <div className="space-y-3">
      <Select
        value={selectedCategoryId ?? undefined}
        onValueChange={(value) => onCategorySelect?.(value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <span
                className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAddCategory}
      >
        Add Category
      </Button>
    </div>
  );
};


