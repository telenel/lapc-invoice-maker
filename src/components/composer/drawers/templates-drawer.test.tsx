import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TemplatesDrawer } from "./templates-drawer";

vi.mock("@/domains/template/api-client", () => ({
  templateApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: "t1",
        name: "Catering Pack",
        category: "Catering",
        notes: "n",
        items: [],
        type: "INVOICE",
      },
    ]),
    create: vi.fn().mockResolvedValue({ id: "t2" }),
  },
}));

describe("TemplatesDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads templates when opened on Load tab", async () => {
    render(
      <TemplatesDrawer
        open
        type="INVOICE"
        mode="load"
        onOpenChange={() => {}}
        onLoadTemplate={vi.fn()}
        onSaveTemplate={vi.fn()}
        initialPayload={{ name: "", category: "", notes: "" }}
      />,
    );
    await waitFor(() => expect(screen.getByText("Catering Pack")).toBeInTheDocument());
  });

  it("posts template on Save submit", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <TemplatesDrawer
        open
        type="INVOICE"
        mode="save"
        onOpenChange={() => {}}
        onLoadTemplate={vi.fn()}
        onSaveTemplate={onSave}
        initialPayload={{ name: "", category: "Catering", notes: "" }}
      />,
    );
    await user.type(screen.getByLabelText(/Template name/i), "My pack");
    await user.click(screen.getByRole("button", { name: /Save Template/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "My pack" }));
  });
});
