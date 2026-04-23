import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dialogCallSites = [
  "src/components/bulk-edit/audit-log-detail-dialog.tsx",
  "src/components/bulk-edit/commit-confirm-dialog.tsx",
  "src/components/bulk-edit/save-search-dialog.tsx",
  "src/components/calendar/add-event-modal.tsx",
  "src/components/products/edit-item-dialog-legacy.tsx",
  "src/components/products/hard-delete-dialog.tsx",
  "src/components/staff/staff-form.tsx",
] as const;

describe("DialogContent desktop widths", () => {
  it.each(dialogCallSites)("%s overrides the sm dialog primitive width", (filePath) => {
    const source = readFileSync(join(process.cwd(), filePath), "utf8");
    const dialogContentClassName = source.match(/<DialogContent\s+className="([^"]*)"/)?.[1];

    expect(dialogContentClassName).toBeDefined();
    expect(dialogContentClassName).toMatch(/sm:max-w-(?:md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|\[)/);
  });
});
