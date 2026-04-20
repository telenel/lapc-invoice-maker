import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface PrismVendorRef {
  vendorId: number;
  name: string;
  pierceItems?: number;
}

export interface PrismDccRef {
  dccId: number;
  deptNum: number | null;
  classNum: number | null;
  catNum: number | null;
  deptName: string;
  className: string | null;
  catName: string | null;
  pierceItems?: number;
}

export interface PrismTaxTypeRef {
  taxTypeId: number;
  description: string;
  pierceItems?: number;
}

export interface PrismTagTypeRef {
  tagTypeId: number;
  label: string;
  subsystem: number | null;
  pierceRows?: number;
}

export interface PrismStatusCodeRef {
  statusCodeId: number;
  label: string;
  pierceRows?: number;
}

export interface PrismPackageTypeRef {
  code: string;
  label: string | null;
  defaultQty: number | null;
  pierceItems?: number;
}

export interface PrismColorRef {
  colorId: number;
  label: string;
  pierceItems?: number;
}

export interface PrismBindingRef {
  bindingId: number;
  label: string;
  pierceBooks?: number;
}

export interface PrismRefs {
  vendors: PrismVendorRef[];
  dccs: PrismDccRef[];
  taxTypes: PrismTaxTypeRef[];
  tagTypes: PrismTagTypeRef[];
  statusCodes: PrismStatusCodeRef[];
  packageTypes: PrismPackageTypeRef[];
  colors: PrismColorRef[];
  bindings: PrismBindingRef[];
}

interface CommittedProductRefSnapshotFile {
  generatedAt: string;
  scope: {
    pierceLocations: number[];
  };
  notes: {
    colorTableUsed: string;
    usageNote: string;
  };
  vendors: PrismVendorRef[];
  dccs: PrismDccRef[];
  taxTypes: PrismTaxTypeRef[];
  tagTypes: PrismTagTypeRef[];
  inventoryStatusCodes: PrismStatusCodeRef[];
  packageTypes: PrismPackageTypeRef[];
  colors: PrismColorRef[];
  bindings: PrismBindingRef[];
}

export interface ProductRefMaps {
  vendorNames: Map<number, string>;
  taxTypeLabels: Map<number, string>;
  tagTypeLabels: Map<number, string>;
  statusCodeLabels: Map<number, string>;
  packageTypeLabels: Map<string, string>;
  colorLabels: Map<number, string>;
  bindingLabels: Map<number, string>;
}

let committedProductRefSnapshotPromise: Promise<PrismRefs> | null = null;

export function loadCommittedProductRefSnapshot(): Promise<PrismRefs> {
  if (!committedProductRefSnapshotPromise) {
    committedProductRefSnapshotPromise = (async () => {
      const file = join(process.cwd(), "docs/prism/ref-data-snapshot-2026-04-19.json");
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw) as CommittedProductRefSnapshotFile;

      return {
        vendors: parsed.vendors,
        dccs: parsed.dccs,
        taxTypes: parsed.taxTypes,
        tagTypes: parsed.tagTypes,
        statusCodes: parsed.inventoryStatusCodes,
        packageTypes: parsed.packageTypes,
        colors: parsed.colors,
        bindings: parsed.bindings,
      };
    })();
  }

  return committedProductRefSnapshotPromise;
}

export function buildProductRefMaps(refs: PrismRefs): ProductRefMaps {
  return {
    vendorNames: new Map(refs.vendors.map((row) => [row.vendorId, row.name])),
    taxTypeLabels: new Map(refs.taxTypes.map((row) => [row.taxTypeId, row.description])),
    tagTypeLabels: new Map(refs.tagTypes.map((row) => [row.tagTypeId, row.label])),
    statusCodeLabels: new Map(refs.statusCodes.map((row) => [row.statusCodeId, row.label])),
    packageTypeLabels: new Map(refs.packageTypes.map((row) => [row.code, row.label ?? row.code])),
    colorLabels: new Map(refs.colors.map((row) => [row.colorId, row.label])),
    bindingLabels: new Map(refs.bindings.map((row) => [row.bindingId, row.label])),
  };
}

export function sortRefsByUsageThenLabel<T extends { label: string; usageCount: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return a.label.localeCompare(b.label);
  });
}
