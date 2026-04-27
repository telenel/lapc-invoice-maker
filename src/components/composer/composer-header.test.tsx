import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ComposerHeader } from "./composer-header";

describe("ComposerHeader", () => {
  it("renders breadcrumb + title for invoice/new", () => {
    render(
      <ComposerHeader
        docType="invoice"
        mode="create"
        status="DRAFT"
        documentNumber={undefined}
        date="2026-04-26"
        isRunning={false}
        actionsRight={<button>preview</button>}
      />,
    );
    expect(screen.getByText(/LAPORTAL/)).toBeInTheDocument();
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByText(/New Invoice/)).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
  });

  it("renders edit-mode for quote with document number", () => {
    render(
      <ComposerHeader
        docType="quote"
        mode="edit"
        status="SENT"
        documentNumber="QUO-1234"
        date="2026-04-26"
        isRunning={false}
      />,
    );
    expect(screen.getByText("Quotes")).toBeInTheDocument();
    expect(screen.getByText(/Edit Quote/)).toBeInTheDocument();
    // documentNumber appears twice (breadcrumb crumb + title row)
    expect(screen.getAllByText("QUO-1234").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("SENT")).toBeInTheDocument();
    expect(screen.getByText("QUOTE")).toBeInTheDocument();
  });

  it("renders running badge when isRunning", () => {
    render(
      <ComposerHeader
        docType="invoice"
        mode="create"
        status="DRAFT"
        date="2026-04-26"
        isRunning
      />,
    );
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
  });
});
