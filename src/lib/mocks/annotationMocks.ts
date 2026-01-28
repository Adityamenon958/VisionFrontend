import type { Annotation, Category, Image } from "@/types/annotation";

// Mock data for Phase 1 UI scaffolding (no real backend integration)

export const mockImages: Image[] = [
  { id: "1", filename: "image1.jpg", url: "/placeholder.svg" },
  { id: "2", filename: "image2.jpg", url: "/placeholder.svg" },
  { id: "3", filename: "image3.jpg", url: "/placeholder.svg" },
  { id: "4", filename: "image4.jpg", url: "/placeholder.svg" },
  { id: "5", filename: "image5.jpg", url: "/placeholder.svg" },
];

export const mockCategories: Category[] = [
  { id: "1", name: "Defect", color: "#ef4444" },
  { id: "2", name: "Good", color: "#22c55e" },
  { id: "3", name: "Unknown", color: "#6b7280" },
];

export const mockAnnotations: Annotation[] = [];

