import { describe, expect, it } from "vitest";
import { DEFAULT_ORDER, SORTABLE_WIDGETS } from "@/components/dashboard/dashboard-widget-stack";

describe("dashboard widget config", () => {
  it("does not expose a separate pending POS widget", () => {
    expect(DEFAULT_ORDER).not.toContain("pending-charges");
    expect(SORTABLE_WIDGETS.map((widget) => widget.id)).not.toContain("pending-charges");
  });
});
