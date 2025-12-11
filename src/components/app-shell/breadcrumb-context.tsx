import React, { createContext, useContext, useState } from "react";
import type { BreadcrumbItem } from "./Breadcrumbs";

type BreadcrumbContextValue = {
  items: BreadcrumbItem[] | null;
  setItems: (items: BreadcrumbItem[] | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | undefined>(undefined);

export const BreadcrumbProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<BreadcrumbItem[] | null>(null);

  return (
    <BreadcrumbContext.Provider value={{ items, setItems }}>
      {children}
    </BreadcrumbContext.Provider>
  );
};

export const useBreadcrumbs = (): BreadcrumbContextValue => {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumbs must be used within a BreadcrumbProvider");
  }
  return ctx;
};


