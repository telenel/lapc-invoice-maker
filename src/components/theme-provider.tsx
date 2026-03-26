"use client";
import { ThemeProvider } from "next-themes";
export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={["light", "dark", "theme-latte", "theme-frappe", "theme-macchiato", "theme-mocha"]}
    >
      {children}
    </ThemeProvider>
  );
}
