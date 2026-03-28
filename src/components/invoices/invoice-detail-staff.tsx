import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InvoiceStaffDetail } from "@/domains/invoice/types";

interface InvoiceDetailStaffProps {
  staff: InvoiceStaffDetail;
}

export function InvoiceDetailStaff({ staff }: InvoiceDetailStaffProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Member</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">Name</span>
          <span className="font-bold">{staff.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">Title</span>
          <span>{staff.title}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">Department</span>
          <span>{staff.department}</span>
        </div>
        {staff.extension && (
          <div className="flex justify-between text-sm">
            <span className="text-[11px] font-medium text-muted-foreground">Extension</span>
            <span>{staff.extension}</span>
          </div>
        )}
        {staff.email && (
          <div className="flex justify-between text-sm">
            <span className="text-[11px] font-medium text-muted-foreground">Email</span>
            <span>{staff.email}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
