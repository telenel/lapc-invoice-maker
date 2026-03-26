import { Suspense } from "react";
import { SettingsPanel } from "@/components/admin/settings-panel";

export default function AdminSettingsPage() {
  return (
    <Suspense>
      <SettingsPanel />
    </Suspense>
  );
}
