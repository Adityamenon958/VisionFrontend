import React, { useState } from "react";
import type { Category } from "@/types/annotation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Edit2, ArrowUp, ArrowDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryManagerProps {
  categories: Category[];
  onCategoryCreate: (category: Omit<Category, "id">) => Promise<void>;
  onCategoryUpdate: (id: string, updates: Partial<Category>) => Promise<void>;
  onCategoryDelete: (id: string, reassignTo?: string) => Promise<void>;
  onCategoryReorder: (categoryIds: string[]) => Promise<void>;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  onCategoryCreate,
  onCategoryUpdate,
  onCategoryDelete,
  onCategoryReorder,
}) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState("#ef4444");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // Preset colors
  const presetColors = [
    "#ef4444", // red
    "#22c55e", // green
    "#3b82f6", // blue
    "#f59e0b", // amber
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#6b7280", // gray
    "#14b8a6", // teal
  ];

  const handleCreate = async () => {
    if (!createName.trim()) return;

    await onCategoryCreate({
      name: createName.trim(),
      color: createColor,
    });

    setCreateName("");
    setCreateColor("#ef4444");
    setIsCreateDialogOpen(false);
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;

    await onCategoryUpdate(editingId, {
      name: editName.trim(),
      color: editColor,
    });

    setEditingId(null);
    setEditName("");
    setEditColor("");
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    await onCategoryDelete(deletingId, reassignTo || undefined);
    setDeletingId(null);
    setReassignTo("");
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;

    const newOrder = [...categories];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    await onCategoryReorder(newOrder.map((cat) => cat.id));
  };

  const handleMoveDown = async (index: number) => {
    if (index === categories.length - 1) return;

    const newOrder = [...categories];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    await onCategoryReorder(newOrder.map((cat) => cat.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Manage Categories</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          Add Category
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {categories.map((category, index) => (
          <div
            key={category.id}
            className="flex items-center gap-2 p-2 border rounded-md"
          >
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
            {editingId === category.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 flex-1"
                  placeholder="Category name"
                />
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-8 h-8 rounded border"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUpdate}
                  disabled={!editName.trim()}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setEditName("");
                    setEditColor("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-sm">{category.name}</span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === categories.length - 1}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(category)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingId(category.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>
              Add a new category for annotations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Category name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="create-color"
                  value={createColor}
                  onChange={(e) => setCreateColor(e.target.value)}
                  className="w-16 h-10 rounded border"
                />
                <div className="flex gap-1">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: color }}
                      onClick={() => setCreateColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!createName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingId(null);
            setReassignTo("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? You can reassign
              existing annotations to another category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reassign annotations to (optional)</Label>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category or leave empty to delete all" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Delete all annotations</SelectItem>
                  {categories
                    .filter((cat) => cat.id !== deletingId)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

