"use client";

import { useDeferredValue, useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PlusIcon, PencilIcon, UserMinus, SearchIcon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
import { staffApi } from "@/domains/staff/api-client";
import type { StaffResponse } from "@/domains/staff/types";
import type { PaginatedResponse } from "@/domains/shared/types";
import { getInitials } from "@/lib/formatters";
import { useSSE } from "@/lib/use-sse";

const PAGE_SIZE = 20;

export function StaffTable({
  initialData,
}: {
  initialData?: PaginatedResponse<StaffResponse>;
}) {
  const { data: session } = useSession();
  const [staff, setStaff] = useState<StaffResponse[]>(initialData?.data ?? []);
  const [loading, setLoading] = useState(() => initialData === undefined);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const skippedInitialFetchRef = useRef(initialData !== undefined);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const canDeactivateStaff = (session?.user as { role?: string } | undefined)?.role === "admin";
  const currentRequestKey = JSON.stringify({
    page,
    pageSize: PAGE_SIZE,
    search: deferredSearch || undefined,
  });
  const initialRequestKey = JSON.stringify({ page: 1, pageSize: PAGE_SIZE });

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const result = await staffApi.listPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: deferredSearch || undefined,
      });
      setStaff(result.data);
      setTotal(result.total);
    } catch {
      toast.error("Failed to load staff directory");
    }
    setLoading(false);
  }, [page, deferredSearch]);

  useEffect(() => {
    if (skippedInitialFetchRef.current && currentRequestKey === initialRequestKey) {
      skippedInitialFetchRef.current = false;
      return;
    }

    void fetchStaff();
  }, [currentRequestKey, fetchStaff, initialRequestKey]);

  useSSE("staff-changed", fetchStaff);

  // Reset to page 1 when search changes
  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`Deactivate ${name}? They will be removed from the directory.`))
      return;

    try {
      await staffApi.delete(id);
      toast.success("Staff member deactivated");
      fetchStaff();
    } catch {
      toast.error("Failed to deactivate staff member");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pierce College staff directory</p>
        </div>
        <StaffForm
          onSave={fetchStaff}
          trigger={
            <Button className="w-full sm:w-auto">
              <PlusIcon />
              Add Staff Member
            </Button>
          }
        />
      </div>

      <div className="relative w-full max-w-xs">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search staff…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-8 h-8"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-4">
              <div className="skeleton h-[34px] w-[34px] rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-32" />
                <div className="skeleton h-2.5 w-48" />
              </div>
              <div className="skeleton h-2.5 w-20 shrink-0" />
            </div>
          ))}
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="size-7" />}
          illustration={search ? "/illustrations/empty-no-results.png" : "/illustrations/empty-staff.png"}
          title={search ? "No staff members match your search" : "No staff members yet"}
          description={search ? "Try a different search term." : "Add your first staff member to get started."}
          action={
            search
              ? { label: "Clear Search", onClick: () => handleSearch(""), variant: "outline" as const }
              : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {staff.map((member) => (
              <div key={member.id} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-muted-foreground">
                    {getInitials(member.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold">{member.name}</p>
                      <Badge variant="secondary">{member.department.replace(/^[,\s]+/, "").trim()}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{member.title}</p>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>{member.email || "No email listed"}</p>
                      <p>
                        {member.extension ? `Ext. ${member.extension}` : "No extension"}
                        {member.accountCode ? ` · ${member.accountCode}` : ""}
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <StaffForm
                        staff={member}
                        onSave={fetchStaff}
                        trigger={
                          <Button variant="outline" size="sm" className="flex-1">
                            <PencilIcon />
                            Edit
                          </Button>
                        }
                      />
                      {canDeactivateStaff ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDeactivate(member.id, member.name)}
                        >
                          <UserMinus />
                          Deactivate
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Table className="hidden w-full table-fixed md:table">
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
              {staff.map((member, index) => (
                <TableRow
                  key={member.id}
                  className={`hover:bg-muted/30 transition-colors ${index % 2 === 1 ? "bg-muted/15" : ""}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-[30px] h-[30px] rounded-lg bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                        {getInitials(member.name)}
                      </div>
                      <span className="font-bold">{member.name}</span>
                    </div>
                  </TableCell>
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
                      {canDeactivateStaff ? (
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
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-2.5">
            <p className="text-sm text-muted-foreground tabular-nums">
              Page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{totalPages}</span> ({total} staff member{total !== 1 ? "s" : ""})
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex-1 sm:flex-none"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex-1 sm:flex-none"
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
