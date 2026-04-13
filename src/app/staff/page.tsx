import { staffService } from "@/domains/staff/service";
import { StaffTable } from "@/components/staff/staff-table";

export default async function StaffPage() {
  const initialData = await staffService.listPaginated({
    page: 1,
    pageSize: 20,
  });

  return <StaffTable initialData={initialData} />;
}
