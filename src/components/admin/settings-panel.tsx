"use client";

import { CategoryManager } from "./category-manager";

export function SettingsPanel() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin Settings</h1>

      <section className="space-y-4">
        <div className="border rounded-lg p-6">
          <CategoryManager />
        </div>
      </section>
    </div>
  );
}
