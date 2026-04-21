import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Regression tests for the Phase 2 Accordion wrapper. Catches the original
 * bug flagged by Codex adversarial review on PR #229: the Panel's height
 * transition was keyed to `data-[panel-open]`, which Base UI only emits on
 * the Trigger. The Panel emits `data-open` / `data-closed`. With the wrong
 * selector the height rule never matched and the disclosure content stayed
 * collapsed after clicking the trigger.
 */
describe("Accordion", () => {
  function renderFixture() {
    // `keepMounted` is opt-in at call sites that need collapsed content to
    // remain in the DOM — these assertions query the panel directly, so we
    // mount persistently here to make the test deterministic. Real product
    // callers (edit dialog) keep Base UI's default unmount-on-close so
    // collapsed form inputs don't leak into keyboard nav or screen readers.
    render(
      <Accordion keepMounted>
        <AccordionItem value="alpha">
          <AccordionTrigger>Alpha trigger</AccordionTrigger>
          <AccordionContent>
            <p>Alpha content body</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
  }

  it("renders the trigger and the hidden panel", () => {
    renderFixture();
    expect(screen.getByRole("button", { name: "Alpha trigger" })).toBeInTheDocument();
    const panel = screen.getByText("Alpha content body").closest('[data-slot="accordion-content"]');
    expect(panel).not.toBeNull();
    // Closed state: panel carries data-closed from Base UI's collapsible mapping.
    expect(panel?.hasAttribute("data-closed")).toBe(true);
    expect(panel?.hasAttribute("data-open")).toBe(false);
  });

  it("expands the panel when the trigger is clicked", async () => {
    renderFixture();
    const trigger = screen.getByRole("button", { name: "Alpha trigger" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("data-panel-open");

    const panel = screen.getByText("Alpha content body").closest('[data-slot="accordion-content"]');
    expect(panel).not.toBeNull();
    // Open state: panel carries data-open, which is what the height rule
    // must key on to apply the expanded style.
    expect(panel?.hasAttribute("data-open")).toBe(true);
    expect(panel?.hasAttribute("data-closed")).toBe(false);
  });

  it("collapses the panel when the trigger is clicked a second time", async () => {
    renderFixture();
    const trigger = screen.getByRole("button", { name: "Alpha trigger" });

    await userEvent.click(trigger);
    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("data-panel-open");

    const panel = screen.getByText("Alpha content body").closest('[data-slot="accordion-content"]');
    expect(panel?.hasAttribute("data-closed")).toBe(true);
  });

  it("Panel's height transition CSS keys on data-open (not data-panel-open)", () => {
    // Guard against regressing to the original Codex-flagged bug: the
    // selector must match the attribute Base UI actually emits on the
    // Panel element. If someone re-introduces `data-[panel-open]` on the
    // content class, this assertion fails.
    renderFixture();
    const panel = screen.getByText("Alpha content body").closest('[data-slot="accordion-content"]');
    expect(panel?.className ?? "").toMatch(/data-\[open\]:h-\[var\(--accordion-panel-height\)\]/);
    expect(panel?.className ?? "").not.toMatch(/data-\[panel-open\]:h-/);
  });
});
