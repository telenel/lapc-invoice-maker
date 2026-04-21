import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression test for the Tailwind v4 custom variants required by the shadcn
 * Tabs and Separator primitives.
 *
 * Background: src/components/ui/tabs.tsx and src/components/ui/separator.tsx
 * use class names like `data-horizontal:flex-col`, `data-vertical:w-px`,
 * `group-data-horizontal/tabs:*`, and `group-data-vertical/tabs:*`. Those
 * classes rely on Tailwind variants named `data-horizontal` and `data-vertical`
 * that target the underlying `data-orientation` attribute emitted by the
 * Base UI tabs primitive. `data-active` targets the `data-active` attribute
 * that Base UI emits on the currently-active tab trigger.
 *
 * Without the custom-variant declarations in globals.css, these utilities
 * silently fail: the Tabs root defaults to `flex-direction: row` (instead of
 * column), the TabsList height and active underline do not apply, and
 * horizontal Separators collapse. See plan file Phase 0 for the full story.
 *
 * This test pins the registration so a future refactor cannot accidentally
 * remove the variants.
 */

const repoRoot = process.cwd();
const globalsCss = fs.readFileSync(path.join(repoRoot, "src/app/globals.css"), "utf8");

describe("src/app/globals.css — Tailwind v4 custom variants", () => {
  it("registers @custom-variant data-horizontal targeting [data-orientation=horizontal]", () => {
    expect(globalsCss).toMatch(
      /@custom-variant\s+data-horizontal\s+\(&\[data-orientation="horizontal"\]\)/,
    );
  });

  it("registers @custom-variant data-vertical targeting [data-orientation=vertical]", () => {
    expect(globalsCss).toMatch(
      /@custom-variant\s+data-vertical\s+\(&\[data-orientation="vertical"\]\)/,
    );
  });

  it("registers @custom-variant data-active targeting [data-active]", () => {
    expect(globalsCss).toMatch(/@custom-variant\s+data-active\s+\(&\[data-active\]\)/);
  });
});
