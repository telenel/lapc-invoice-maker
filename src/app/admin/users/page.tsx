import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { UserManagement } from "@/components/admin/user-management";
import { authOptions } from "@/lib/auth";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  return <UserManagement />;
}
