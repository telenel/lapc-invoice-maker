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
  return (
    <>
      <div className="space-y-1.5">
        <Label>Vendor</Label>
        <Select value={vendorId} onValueChange={(v) => onChange("vendorId", v ?? "")} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            {refs?.vendors.map((v) => (
              <SelectItem key={v.vendorId} value={String(v.vendorId)}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>DCC</Label>
        <Select value={dccId} onValueChange={(v) => onChange("dccId", v ?? "")} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            {refs?.dccs.map((d) => (
              <SelectItem key={d.dccId} value={String(d.dccId)}>
                {d.deptName} / {d.className ?? "—"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Tax Type</Label>
        <Select value={itemTaxTypeId} onValueChange={(v) => onChange("itemTaxTypeId", v ?? "")} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            {refs?.taxTypes.map((t) => (
              <SelectItem key={t.taxTypeId} value={String(t.taxTypeId)}>{t.description}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
