import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The `DialogContent` primitive in `src/components/ui/dialog.tsx` bakes in
 * `sm:max-w-sm`. Any consumer that passes a plain `max-w-X` override (without
 * an `sm:` prefix) loses the `twMerge` dedupe fight at every breakpoint ≥640px
 * and ends up clipped to ~384px on desktop — the "tiny mobile-sized box" bug
 * that PR #247 fixed for the Quick Picks dialog.
 *
 * This test guards the dialogs that previously had the broken pattern. It
 * asserts that every listed DialogContent uses an `sm:`-prefixed width larger
 * than `sm` so the override actually wins on desktop.
 */

const ROOT = resolve(__dirname, "..", "..");

const DIALOGS: ReadonlyArray<{ file: string; description: string }> = [
  {
    file: "src/components/bulk-edit/audit-log-detail-dialog.tsx",
    description: "bulk-edit audit log detail dialog",
  },
  {
    file: "src/components/bulk-edit/commit-confirm-dialog.tsx",
    description: "bulk-edit commit confirmation dialog",
  },
  {
    file: "src/components/bulk-edit/save-search-dialog.tsx",
    description: "bulk-edit save search dialog",
  },
  {
    file: "src/components/calendar/add-event-modal.tsx",
    description: "calendar add event modal",
  },
  {
    file: "src/components/products/edit-item-dialog-legacy.tsx",
    description: "products legacy edit item dialog",
  },
  {
    file: "src/components/products/hard-delete-dialog.tsx",
    description: "products hard delete dialog",
  },
  {
    file: "src/components/staff/staff-form.tsx",
    description: "staff form dialog",
  },
] as const;

const DIALOG_CONTENT_WITH_WIDTH = /<DialogContent[\s\S]*?className="([^"]+)"/;
const SM_PREFIXED_WIDE_WIDTH =
  /sm:max-w-(?:md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|\[)/;
const UNPREFIXED_WIDE_WIDTH =
  /(?<![:\w])max-w-(?:md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)(?!\w)/;

describe("DialogContent width override regression", () => {
  it.each(DIALOGS)(
    "$description uses an `sm:`-prefixed width override",
    ({ file }) => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      const match = source.match(DIALOG_CONTENT_WITH_WIDTH);

      expect(
        match,
        `Expected ${file} to render <DialogContent className="…">`
      ).not.toBeNull();

      const className = match![1];

      expect(
        SM_PREFIXED_WIDE_WIDTH.test(className),
        `Expected ${file} DialogContent to include an sm:-prefixed width ` +
          `override (e.g. sm:max-w-lg). The primitive bakes in sm:max-w-sm, ` +
          `so an unprefixed max-w-X loses the twMerge dedupe and the dialog ` +
          `renders at ~384px on desktop. Got className: ${className}`
      ).toBe(true);

      expect(
        UNPREFIXED_WIDE_WIDTH.test(className),
        `Expected ${file} DialogContent to NOT mix in an unprefixed max-w-X ` +
          `wider than sm (that's the broken pattern). Got className: ${className}`
      ).toBe(false);
    }
  );
});
