"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { UserManagement } from "./user-management";
import { CategoryManager } from "./category-manager";
import { DbHealth } from "./db-health";

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
        <TabsList>
          <TabsTrigger value="users">Users &amp; Access Codes</TabsTrigger>
          <TabsTrigger value="categories">Invoice Categories</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="general">General Settings</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "users" && <UserManagement />}
      {activeTab === "categories" && (
        <div className="border rounded-lg p-6">
          <CategoryManager />
        </div>
      )}
      {activeTab === "database" && (
        <div className="border rounded-lg p-6">
          <DbHealth />
        </div>
      )}
      {activeTab === "general" && (
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">General Settings</h2>
          <p className="text-sm text-muted-foreground">
            Additional settings will be available here in future updates (email configuration, default values, etc.)
          </p>
        </div>
      )}
    </div>
  );
}
