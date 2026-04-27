import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SectionCard } from "./section-card";

describe("SectionCard", () => {
  it("renders title, step, and children", () => {
    render(
      <SectionCard step={1} title="People" anchor="section-people" status="default">
        <p>body</p>
      </SectionCard>,
    );
    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByLabelText(/Step 1 of 6/)).toBeInTheDocument();
  });

  it("shows completion state on the badge", () => {
    render(
      <SectionCard step={2} title="Dept" anchor="section-department" status="complete">
        <p>x</p>
      </SectionCard>,
    );
    expect(screen.getByLabelText(/Step 2 of 6, complete/)).toBeInTheDocument();
  });

  it("shows blocker state on the badge", () => {
    render(
      <SectionCard step={3} title="Det" anchor="section-details" status="blocker">
        <p>x</p>
      </SectionCard>,
    );
    expect(screen.getByLabelText(/Step 3 of 6, blocker/)).toBeInTheDocument();
  });

  it("uses anchor as the element id", () => {
    const { container } = render(
      <SectionCard step={1} title="x" anchor="section-people" status="default">
        <p>x</p>
      </SectionCard>,
    );
    expect(container.querySelector("#section-people")).not.toBeNull();
  });

  it("renders a right-side action when provided", () => {
    render(
      <SectionCard
        step={4}
        title="Items"
        anchor="section-items"
        status="default"
        action={<button>act</button>}
      >
        <p>x</p>
      </SectionCard>,
    );
    expect(screen.getByText("act")).toBeInTheDocument();
  });
});
