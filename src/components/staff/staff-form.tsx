"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StaffMember {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
}

interface StaffFormProps {
  staff?: StaffMember;
  onSave: () => void;
  trigger: React.ReactNode;
}

export function StaffForm({ staff, onSave, trigger }: StaffFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);

  const [name, setName] = useState(staff?.name ?? "");
  const [title, setTitle] = useState(staff?.title ?? "");
  const [department, setDepartment] = useState(staff?.department ?? "");
  const [accountCode, setAccountCode] = useState(staff?.accountCode ?? "");
  const [extension, setExtension] = useState(staff?.extension ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [approvalChain, setApprovalChain] = useState<string[]>(
    staff?.approvalChain ?? []
  );

  const isEdit = !!staff;

  async function handleOpen() {
    setName(staff?.name ?? "");
    setTitle(staff?.title ?? "");
    setDepartment(staff?.department ?? "");
    setAccountCode(staff?.accountCode ?? "");
    setExtension(staff?.extension ?? "");
    setEmail(staff?.email ?? "");
    setPhone(staff?.phone ?? "");
    setApprovalChain(staff?.approvalChain ?? []);
    setOpen(true);

    const res = await fetch("/api/staff");
    if (res.ok) {
      const data = await res.json();
      setAllStaff(data);
    }
  }

  function toggleApprover(id: string) {
    setApprovalChain((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name,
      title,
      department,
      accountCode,
      extension,
      email,
      phone,
      approvalChain,
    };

    const url = isEdit ? `/api/staff/${staff.id}` : "/api/staff";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const fieldErrors = data?.error?.fieldErrors as
        | Record<string, string[]>
        | undefined;
      const firstFieldError = fieldErrors
        ? (Object.values(fieldErrors)[0]?.[0] ?? undefined)
        : undefined;
      const msg =
        (data?.error?.formErrors as string[] | undefined)?.[0] ??
        firstFieldError ??
        "Failed to save staff member";
      toast.error(msg);
      return;
    }

    toast.success(isEdit ? "Staff member updated" : "Staff member created");
    setOpen(false);
    onSave();
  }

  const otherStaff = allStaff.filter((s) => s.id !== staff?.id);

  return (
    <>
      <span onClick={handleOpen} style={{ display: "contents" }}>
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-title">Title</Label>
                <Input
                  id="staff-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Program Manager"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-department">Department</Label>
                <Input
                  id="staff-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Workforce Development"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-account-code">Account Code</Label>
                <Input
                  id="staff-account-code"
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  placeholder="e.g. 1234-56"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-extension">Extension</Label>
                <Input
                  id="staff-extension"
                  value={extension}
                  onChange={(e) => setExtension(e.target.value)}
                  placeholder="e.g. 4201"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jane@lapc.edu"
                />
              </div>
              <div className="grid gap-1.5 col-span-2">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input
                  id="staff-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. (213) 555-0100"
                />
              </div>
            </div>

            {otherStaff.length > 0 && (
              <div className="grid gap-2">
                <Label>Approval Chain</Label>
                <p className="text-sm text-muted-foreground">
                  Select staff members who approve this person&apos;s invoices.
                </p>
                <div className="border rounded-md p-3 grid gap-2 max-h-48 overflow-y-auto">
                  {otherStaff.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={approvalChain.includes(s.id)}
                        onChange={() => toggleApprover(s.id)}
                        className="h-4 w-4"
                      />
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">
                        — {s.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading
                  ? "Saving…"
                  : isEdit
                  ? "Save Changes"
                  : "Add Staff Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
