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
import { staffApi } from "@/domains/staff/api-client";
import type { StaffResponse } from "@/domains/staff/types";

interface StaffFormProps {
  staff?: StaffResponse;
  onSave: () => void;
  trigger: React.ReactNode;
}

export function StaffForm({ staff, onSave, trigger }: StaffFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allStaff, setAllStaff] = useState<StaffResponse[]>([]);

  const [name, setName] = useState(staff?.name ?? "");
  const [title, setTitle] = useState(staff?.title ?? "");
  const [department, setDepartment] = useState(staff?.department ?? "");
  const [accountCode, setAccountCode] = useState(staff?.accountCode ?? "");
  const [extension, setExtension] = useState(staff?.extension ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [birthMonth, setBirthMonth] = useState<number | undefined>(
    staff?.birthMonth ?? undefined
  );
  const [birthDay, setBirthDay] = useState<number | undefined>(
    staff?.birthDay ?? undefined
  );
  const [approvalChain, setApprovalChain] = useState<string[]>(
    () => staff?.approvalChain ?? [],
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
    setBirthMonth(staff?.birthMonth ?? undefined);
    setBirthDay(staff?.birthDay ?? undefined);
    setApprovalChain(staff?.approvalChain ?? []);
    setOpen(true);

    try {
      const data = await staffApi.list();
      setAllStaff(data);
    } catch {
      // non-critical — approval chain picker won't show
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
      ...(isEdit || birthMonth !== undefined ? { birthMonth } : {}),
      ...(isEdit || birthDay !== undefined ? { birthDay } : {}),
      approvalChain,
    };

    try {
      if (isEdit) {
        await staffApi.update(staff.id, payload);
      } else {
        await staffApi.create(payload);
      }
    } catch (err) {
      setLoading(false);
      toast.error(err instanceof Error ? err.message : "Failed to save staff member");
      return;
    }

    setLoading(false);

    toast.success(isEdit ? "Staff member updated" : "Staff member created");
    setOpen(false);
    onSave();
  }

  const otherStaff = allStaff.filter((s) => s.id !== staff?.id);

  return (
    <>
      <div onClick={handleOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpen(); } }} role="button" tabIndex={0} style={{ display: "contents" }}>
        {trigger}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe…"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-title">Title</Label>
                <Input
                  id="staff-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Program Manager…"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-department">Department</Label>
                <Input
                  id="staff-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Workforce Development…"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-account-code">Account Code</Label>
                <Input
                  id="staff-account-code"
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  placeholder="e.g. 1234-56…"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-extension">Extension</Label>
                <Input
                  id="staff-extension"
                  value={extension}
                  onChange={(e) => setExtension(e.target.value)}
                  placeholder="e.g. 4201…"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jane@lapc.edu…"
                  spellCheck={false}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input
                  id="staff-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. (213) 555-0100…"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-birth-month">Birth Month</Label>
                <select
                  id="staff-birth-month"
                  value={birthMonth ?? ""}
                  onChange={(e) =>
                    setBirthMonth(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select month...</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-birth-day">Birth Day</Label>
                <Input
                  id="staff-birth-day"
                  type="number"
                  min={1}
                  max={31}
                  step={1}
                  value={birthDay ?? ""}
                  onChange={(e) =>
                    setBirthDay(e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="e.g. 15…"
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
