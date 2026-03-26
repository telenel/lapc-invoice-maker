"use client";

import { useState, useEffect } from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  active: boolean;
}

interface StaffSelectProps {
  selectedId?: string;
  onSelect: (staff: StaffMember) => void;
  placeholder?: string;
  className?: string;
}

export function StaffSelect({
  selectedId,
  onSelect,
  placeholder = "Select staff member…",
  className,
}: StaffSelectProps) {
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/staff")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StaffMember[]) => setStaff(data))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, []);

  const selected = staff.find((s) => s.id === selectedId);

  function handleSelect(staffMember: StaffMember) {
    onSelect(staffMember);
    setOpen(false);
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    // Enter and Space are already handled by Radix PopoverTrigger.
    // Escape closes if open.
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[placeholder]:text-muted-foreground",
          className
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={cn(!selected && "text-muted-foreground")}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-full max-w-sm p-0"
        align="start"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <Command
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget.querySelector<HTMLElement>(
                '[aria-selected="true"], [data-selected="true"]'
              );
              if (el) {
                const value = el.getAttribute("data-value") ?? el.textContent ?? "";
                const match = staff.find(
                  (s) =>
                    `${s.name} ${s.title} ${s.department}` === value ||
                    el.querySelector(".font-semibold")?.textContent === s.name
                );
                if (match) handleSelect(match);
              }
            }
          }}
        >
          <CommandInput placeholder="Search staff…" />
          <CommandList className="max-h-60">
            {loading ? (
              <CommandEmpty>Loading…</CommandEmpty>
            ) : staff.length === 0 ? (
              <CommandEmpty>No staff found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {staff.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`${s.name} ${s.title} ${s.department}`}
                    onSelect={() => handleSelect(s)}
                    data-checked={s.id === selectedId ? "true" : undefined}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.title}
                        {s.department && s.department.trim() ? `, ${s.department.trim()}` : ""}
                        {s.extension ? ` ext. ${s.extension}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
