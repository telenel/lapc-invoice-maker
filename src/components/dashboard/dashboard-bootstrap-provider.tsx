"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DashboardBootstrapData } from "@/domains/dashboard/types";

const DashboardBootstrapContext = createContext<DashboardBootstrapData | null>(null);

export function DashboardBootstrapProvider({
  value,
  children,
}: {
  value: DashboardBootstrapData | null;
  children: ReactNode;
}) {
  return (
    <DashboardBootstrapContext.Provider value={value}>
      {children}
    </DashboardBootstrapContext.Provider>
  );
}

export function useDashboardBootstrapData() {
  return useContext(DashboardBootstrapContext);
}
