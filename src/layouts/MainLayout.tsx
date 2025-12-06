// src/layouts/MainLayout.tsx
// This file now uses the new AppShell component while maintaining backward compatibility
import { AppShell } from "@/components/app-shell/AppShell";

// MainLayout is kept for backward compatibility with existing routes
// It now uses the new AppShell component
const MainLayout = () => {
  return <AppShell />;
};

export default MainLayout;
