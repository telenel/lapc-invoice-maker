import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

describe("Sheet", () => {
  it("opens when the trigger is clicked and renders title + body", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>open</SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Title</SheetTitle>
          </SheetHeader>
          <p>body</p>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.queryByText("body")).toBeNull();
    await user.click(screen.getByText("open"));
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
  });
});
