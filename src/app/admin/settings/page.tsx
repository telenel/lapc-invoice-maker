import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { authOptions } from "@/lib/auth";

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  return (
    <Suspense>
      <SettingsPanel />
    </Suspense>
  );
}
