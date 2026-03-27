"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams, useRouter } from "next/navigation";
import { UserManagement } from "./user-management";
import { CategoryManager } from "./category-manager";
import { InvoiceManager } from "./invoice-manager";
import { LineItemManager } from "./line-item-manager";
import { DbHealth } from "./db-health";

const VALID_TABS = ["users", "categories", "invoices", "line-items", "database", "general"];

export function SettingsPanel() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramTab = searchParams.get("tab");
  const activeTab = paramTab && VALID_TABS.includes(paramTab) ? paramTab : "users";

  function setActiveTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
        <TabsList>
          <TabsTrigger value="users">Users &amp; Access Codes</TabsTrigger>
          <TabsTrigger value="categories">Invoice Categories</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="line-items">Line Items</TabsTrigger>
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
      {activeTab === "invoices" && (
        <div className="border rounded-lg p-6">
          <InvoiceManager />
        </div>
      )}
      {activeTab === "line-items" && (
        <div className="border rounded-lg p-6">
          <LineItemManager />
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
