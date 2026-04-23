import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dialogs = [
  ["bulk-edit/audit-log-detail-dialog", "src/components/bulk-edit/audit-log-detail-dialog.tsx", "sm:max-w-3xl"],
  ["bulk-edit/commit-confirm-dialog", "src/components/bulk-edit/commit-confirm-dialog.tsx", "sm:max-w-lg"],
  ["bulk-edit/save-search-dialog", "src/components/bulk-edit/save-search-dialog.tsx", "sm:max-w-md"],
  ["calendar/add-event-modal", "src/components/calendar/add-event-modal.tsx", "sm:max-w-2xl"],
  ["products/edit-item-dialog-legacy", "src/components/products/edit-item-dialog-legacy.tsx", "sm:max-w-2xl"],
  ["products/hard-delete-dialog", "src/components/products/hard-delete-dialog.tsx", "sm:max-w-2xl"],
  ["staff/staff-form", "src/components/staff/staff-form.tsx", "sm:max-w-2xl"],
] as const;

describe("DialogContent desktop widths", () => {
  it.each(dialogs)("%s overrides the primitive desktop width", (_name, filePath, widthClass) => {
    const source = readFileSync(join(process.cwd(), filePath), "utf8");

    // DialogContent defaults to sm:max-w-sm, so desktop-sized dialogs need a
    // sm: width override rather than only an unprefixed max-w-* class.
    expect(source).toContain(widthClass);
  });
});
