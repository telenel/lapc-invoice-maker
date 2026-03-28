"use client";

import { useState, useEffect, useRef } from "react";
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
import { staffApi } from "@/domains/staff/api-client";
import type { StaffResponse } from "@/domains/staff/types";

interface StaffSignatureSelectProps {
  /** The staff ID that is currently selected (for highlighting) */
  selectedId?: string;
  /** The display string shown in the trigger (e.g. "Jane Doe, Dean") */
  displayValue?: string;
  onSelect: (staff: StaffResponse) => void;
  placeholder?: string;
  className?: string;
}

export function StaffSignatureSelect({
  selectedId,
  displayValue,
  onSelect,
  placeholder = "Select staff member…",
  className,
}: StaffSignatureSelectProps) {
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<StaffResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const commandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    staffApi.list()
      .then((data) => setStaff(data))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const list = commandRef.current?.querySelector('[data-slot="command-list"]');
    if (!list || !open) return;
    list.scrollTop = 0;
    const reset = () => { list.scrollTop = 0; };
    list.addEventListener("scroll", reset);
    const timer = setTimeout(() => list.removeEventListener("scroll", reset), 100);
    return () => { clearTimeout(timer); list.removeEventListener("scroll", reset); };
  }, [search, open]);

  function handleSelect(staffMember: StaffResponse) {
    onSelect(staffMember);
    setOpen(false);
  }

  const hasValue = !!displayValue;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSearch(""); }}>
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={cn("min-w-0", !hasValue && "text-muted-foreground")}>
          {hasValue ? displayValue : placeholder}
        </span>
        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
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
        <div ref={commandRef}>
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
          <CommandInput
            placeholder="Search staff…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <CommandEmpty>Loading…</CommandEmpty>
            ) : staff.length === 0 ? (
              <CommandEmpty>No staff found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {staff.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`${s.name} ${s.name.includes(",") ? s.name.split(",").map(p => p.trim()).reverse().join(" ") : ""} ${s.title} ${s.department}`}
                    onSelect={() => handleSelect(s)}
                    data-checked={s.id === selectedId ? "true" : undefined}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[s.title, s.department?.trim()].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        </div>
      </PopoverContent>
    </Popover>
  );
}
