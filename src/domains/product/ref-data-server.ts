import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CommittedProductRefSnapshotFile, PrismRefs } from "./ref-data";

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
