import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InvoiceStaffDetail } from "@/domains/invoice/types";
import type { ContactResponse } from "@/domains/contact/types";

interface InvoiceDetailStaffProps {
  staff: InvoiceStaffDetail | null;
  contact?: ContactResponse | null;
}

export function InvoiceDetailStaff({ staff, contact }: InvoiceDetailStaffProps) {
  // Show contact info when there is no staff
  if (!staff && contact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[11px] font-medium text-muted-foreground">Name</span>
            <span className="font-bold">{contact.name}</span>
          </div>
          {contact.title && (
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Title</span>
              <span>{contact.title}</span>
            </div>
          )}
          {contact.org && (
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Organization</span>
              <span>{contact.org}</span>
            </div>
          )}
          {contact.department && (
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Department</span>
              <span>{contact.department}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Email</span>
              <span>{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Phone</span>
              <span>{contact.phone}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!staff) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Staff Member</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No staff member assigned</p>
        </CardContent>
      </Card>
    );
  }

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
