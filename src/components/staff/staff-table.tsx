"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { PlusIcon, PencilIcon, UserMinus, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StaffForm } from "./staff-form";

const PAGE_SIZE = 20;

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

export function StaffTable() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (search) params.set("search", search);

    const res = await fetch(`/api/staff?${params}`);
    if (res.ok) {
      const data = await res.json();
      setStaff(data.staff);
      setTotal(data.total);
    } else {
      toast.error("Failed to load staff directory");
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Reset to page 1 when search changes
  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`Deactivate ${name}? They will be removed from the directory.`))
      return;

    const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Staff member deactivated");
      fetchStaff();
    } else {
      toast.error("Failed to deactivate staff member");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Staff Directory</h1>
        <StaffForm
          onSave={fetchStaff}
          trigger={
            <Button>
              <PlusIcon />
              Add Staff Member
            </Button>
          }
        />
      </div>

      <div className="relative max-w-xs">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search staff..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-8 h-8"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : staff.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {search ? "No staff members match your search." : "No staff members yet. Add one to get started."}
        </p>
      ) : (
        <>
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="hidden md:table-cell">Account Code</TableHead>
                <TableHead className="hidden md:table-cell">Extension</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-bold">{member.name}</TableCell>
                  <TableCell>{member.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{member.department.replace(/^[,\s]+/, '').trim()}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{member.accountCode}</TableCell>
                  <TableCell className="hidden md:table-cell">{member.extension}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <StaffForm
                        staff={member}
                        onSave={fetchStaff}
                        trigger={
                          <Button variant="ghost" size="icon-sm" title="Edit" aria-label="Edit staff member">
                            <PencilIcon />
                            <span className="sr-only">Edit</span>
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Deactivate"
                        aria-label="Deactivate staff member"
                        onClick={() => handleDeactivate(member.id, member.name)}
                      >
                        <UserMinus className="text-destructive" />
                        <span className="sr-only">Deactivate</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} staff member{total !== 1 ? "s" : ""})
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
