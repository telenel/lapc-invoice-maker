"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface StaffSummary {
  id: string;
  name: string;
  department: string;
}

interface AccountCode {
  id: string;
  staffId: string;
  accountCode: string;
  description: string;
  lastUsedAt: string;
  createdAt: string;
  staff: StaffSummary;
}

export function AccountCodeManager() {
  const [codes, setCodes] = useState<AccountCode[]>([]);
  const [staffList, setStaffList] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState("");

  // Create form state
  const [newStaffId, setNewStaffId] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/account-codes");
      if (res.ok) setCodes(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/staff");
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.map((s: StaffSummary) => ({ id: s.id, name: s.name, department: s.department })));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCodes();
    fetchStaff();
  }, [fetchCodes, fetchStaff]);

  async function handleCreate() {
    setCreateError(null);
    setCreateSaving(true);
    try {
      const res = await fetch("/api/admin/account-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: newStaffId,
          accountCode: newCode.trim(),
          description: newDescription.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error ?? "Failed to create account code");
        return;
      }
      const created = await res.json();
      setCodes((prev) => [...prev, created]);
      resetCreateForm();
    } catch {
      setCreateError("An unexpected error occurred");
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/account-codes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCodes((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      // ignore
    }
  }

  function resetCreateForm() {
    setCreateOpen(false);
    setNewStaffId("");
    setNewCode("");
    setNewDescription("");
    setCreateError(null);
  }

  const filtered = filter
    ? codes.filter(
        (c) =>
          c.accountCode.toLowerCase().includes(filter.toLowerCase()) ||
          c.description.toLowerCase().includes(filter.toLowerCase()) ||
          c.staff.name.toLowerCase().includes(filter.toLowerCase()) ||
          c.staff.department.toLowerCase().includes(filter.toLowerCase())
      )
    : codes;

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading account numbers...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Account Numbers</h2>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            if (!open) resetCreateForm();
            else setCreateOpen(true);
          }}
        >
          <DialogTrigger render={<Button size="sm">Add Account Number</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Account Number</DialogTitle>
              <DialogDescription>
                Assign a new account number to a staff member.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ac-staff">Staff Member</Label>
                <select
                  id="ac-staff"
                  value={newStaffId}
                  onChange={(e) => setNewStaffId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select a staff member...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.department})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ac-code">Account Number</Label>
                <Input
                  id="ac-code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g. 1234-56"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ac-desc">Description</Label>
                <Input
                  id="ac-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. ASB Fund"
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetCreateForm}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newStaffId || !newCode.trim() || createSaving}
              >
                {createSaving ? "Saving..." : "Add Account Number"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Filter by number, description, staff, or department..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account Number</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Staff Member</TableHead>
            <TableHead>Department</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((code) => (
            <TableRow key={code.id}>
              <TableCell className="font-mono text-sm">{code.accountCode}</TableCell>
              <TableCell>{code.description || <span className="text-muted-foreground">--</span>}</TableCell>
              <TableCell>{code.staff.name}</TableCell>
              <TableCell>{code.staff.department}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(code.id)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                {filter ? "No matching account numbers." : "No account numbers found."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
