import { staffService } from "@/domains/staff/service";
import { StaffTable } from "@/components/staff/staff-table";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const initialData = await staffService.listPaginated({
    page: 1,
    pageSize: 20,
  });

  return <div className="page-enter page-enter-1"><StaffTable initialData={initialData} /></div>;
}
