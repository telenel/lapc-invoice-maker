import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import { getSavedViewsErrorFallback, SavedViewsBar } from "@/components/products/saved-views-bar";

const listViewsMock = vi.fn();

vi.mock("@/domains/product/views-api", () => ({
  listViews: () => listViewsMock(),
}));

beforeEach(() => {
  listViewsMock.mockReset();
  listViewsMock.mockResolvedValue({
    system: SYSTEM_PRESET_VIEWS,
    mine: [],
  });
});

describe("getSavedViewsErrorFallback", () => {
  it("drops stale custom views and resolves to system presets only", () => {
    expect(getSavedViewsErrorFallback()).toEqual({
      system: SYSTEM_PRESET_VIEWS,
      mine: [],
      resolved: SYSTEM_PRESET_VIEWS,
    });
  });

  it("filters the preset browser by searchable workflow text", async () => {
    const user = userEvent.setup();

    render(React.createElement(SavedViewsBar, {
      activeSlug: null,
      activeId: null,
      onPresetClick: vi.fn(),
      onClearPreset: vi.fn(),
      onDeleteClick: vi.fn(),
    }));

    await waitFor(() => expect(listViewsMock).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /browse all presets/i }));
    await user.type(screen.getByRole("searchbox", { name: /search presets/i }), "barcode");

    const results = screen.getByLabelText("Preset browser results");
    expect(within(results).getByText("Missing barcode")).toBeInTheDocument();
    expect(within(results).queryByText("Stockout risk")).not.toBeInTheDocument();
  });
});
