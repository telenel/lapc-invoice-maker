"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { PrismRefs } from "@/domains/product/api-client";

export interface ItemRefSelectsProps {
  refs: PrismRefs | null;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  onChange: (field: "vendorId" | "dccId" | "itemTaxTypeId", value: string) => void;
  /** Bulk-mode: render a "Leave unchanged" placeholder as the default value. */
  bulkMode?: boolean;
  disabled?: boolean;
}

function formatDcc(deptName: string, className: string | null): string {
  const dept = (deptName ?? "").trim();
  const cls = (className ?? "").trim();
  if (dept && cls) return `${dept} / ${cls}`;
  if (dept) return dept;
  if (cls) return cls;
  return "(unnamed)";
}

export function ItemRefSelects({
  refs,
  vendorId,
  dccId,
  itemTaxTypeId,
  onChange,
  bulkMode = false,
  disabled = false,
}: ItemRefSelectsProps) {
  const placeholder = bulkMode ? "Leave unchanged" : "Select…";
  // The default SelectTrigger is `w-fit`, which collapses to placeholder width
  // inside a grid cell. Force full-width so long labels fit. Wider popup so
  // long vendor names aren't truncated mid-scan.
  const triggerClass = "w-full";
  const contentClass = "min-w-[var(--anchor-width)] sm:min-w-80 max-w-[min(32rem,90vw)]";

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="vendor-select">Vendor</Label>
        <Select value={vendorId} onValueChange={(v) => onChange("vendorId", v ?? "")} disabled={disabled}>
          <SelectTrigger id="vendor-select" className={triggerClass}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className={contentClass}>
            {refs?.vendors.map((v) => (
              <SelectItem key={v.vendorId} value={String(v.vendorId)}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dcc-select">Department / Class</Label>
        <Select value={dccId} onValueChange={(v) => onChange("dccId", v ?? "")} disabled={disabled}>
          <SelectTrigger id="dcc-select" className={triggerClass}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className={contentClass}>
            {refs?.dccs.map((d) => (
              <SelectItem key={d.dccId} value={String(d.dccId)}>
                {formatDcc(d.deptName, d.className)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tax-select">Tax Type</Label>
        <Select value={itemTaxTypeId} onValueChange={(v) => onChange("itemTaxTypeId", v ?? "")} disabled={disabled}>
          <SelectTrigger id="tax-select" className={triggerClass}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className={contentClass}>
            {refs?.taxTypes.map((t) => (
              <SelectItem key={t.taxTypeId} value={String(t.taxTypeId)}>
                {t.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
