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

interface StaffSelectProps {
  selectedId?: string;
  onSelect: (staff: StaffResponse) => void;
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

  // Reset scroll to top when search changes or popover opens.
  // cmdk uses rAF to scroll the selected item into view — we temporarily
  // intercept scroll events so the list always starts at the top.
  useEffect(() => {
    const list = commandRef.current?.querySelector('[data-slot="command-list"]');
    if (!list || !open) return;
    list.scrollTop = 0;
    const reset = () => { list.scrollTop = 0; };
    list.addEventListener("scroll", reset);
    const timer = setTimeout(() => list.removeEventListener("scroll", reset), 100);
    return () => { clearTimeout(timer); list.removeEventListener("scroll", reset); };
  }, [search, open]);

  const selected = staff.find((s) => s.id === selectedId);

  function handleSelect(staffMember: StaffResponse) {
    // Capture scroll position before the parent re-renders.
    // Selecting a staff member can cause new DOM sections to appear
    // (staff summary, account select, account code) which shifts layout.
    // The browser's focus-restoration on popover close may then scroll
    // to the top of the page.
    const scrollY = window.scrollY;
    onSelect(staffMember);
    setOpen(false);
    // Restore scroll after the DOM settles from the re-render.
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY });
    });
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
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSearch(""); }}>
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
        <span className={cn("min-w-0", !selected && "text-muted-foreground")}>
          {selected ? selected.name : placeholder}
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
                    value={`${s.name} ${s.name.includes(",") ? s.name.split(",").map(p => p.trim()).reverse().join(" ") : ""} ${s.title} ${s.department}`}
                    onSelect={() => handleSelect(s)}
                    data-checked={s.id === selectedId ? "true" : undefined}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[s.title, s.department?.trim()].filter(Boolean).join(", ")}
                        {s.extension ? ` ext. ${s.extension}` : ""}
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
