import { describe, it, expect } from "vitest";
import { renderIDP, type IDPData } from "@/lib/pdf/templates/idp";

function sampleData(overrides: Partial<IDPData> = {}): IDPData {
  return {
    date: "2026-03-15",
    department: "Bookstore Operations",
    documentNumber: "DOC-2026-001",
    requestingDept: "Student Services",
    sapAccount: "SAP-99887",
    estimatedCost: "$1,250.00",
    approverName: "Jane Doe",
    contactName: "John Smith",
    contactPhone: "(818) 555-1234",
    comments: "Rush order needed",
    items: [
      {
        description: "Textbook: Intro to Chemistry",
        quantity: "5",
        unitPrice: "$45.00",
        extendedPrice: "$225.00",
      },
      {
        description: "Lab Notebook",
        quantity: "10",
        unitPrice: "$12.50",
        extendedPrice: "$125.00",
      },
    ],
    totalAmount: "$350.00",
    ...overrides,
  };
}

describe("IDP Template — data field rendering", () => {
  it("all data fields appear in rendered HTML", () => {
    const data = sampleData();
    const html = renderIDP(data);

    // Date gets parsed into MM/DD/YYYY parts
    expect(html).toContain("03"); // month
    expect(html).toContain("15"); // day
    expect(html).toContain("2026"); // year

    expect(html).toContain(data.department);
    expect(html).toContain(data.documentNumber);
    expect(html).toContain(data.requestingDept);
    expect(html).toContain(data.sapAccount);
    expect(html).toContain(data.estimatedCost);
    expect(html).toContain(data.approverName);
    expect(html).toContain(data.contactName);
    expect(html).toContain(data.contactPhone);
    expect(html).toContain(data.comments!);
    expect(html).toContain(data.totalAmount);
  });

  it("item descriptions appear in output", () => {
    const data = sampleData();
    const html = renderIDP(data);

    expect(html).toContain("Textbook: Intro to Chemistry");
    expect(html).toContain("Lab Notebook");
  });

  it("item quantities appear in output", () => {
    const data = sampleData();
    const html = renderIDP(data);

    // Quantities are rendered in table cells
    expect(html).toContain(">5<");
    expect(html).toContain(">10<");
  });

  it("item prices appear in output", () => {
    const data = sampleData();
    const html = renderIDP(data);

    expect(html).toContain("$45.00");
    expect(html).toContain("$12.50");
    expect(html).toContain("$225.00");
    expect(html).toContain("$125.00");
  });

  it("empty items array produces padded rows (at least 4)", () => {
    const data = sampleData({ items: [] });
    const html = renderIDP(data);

    // The template pads to at least 4 rows. Empty rows have
    // empty description cells, so count <tr> within the dept-items section.
    // Each padded row produces a <tr> with empty <td> cells.
    // We check that at least 4 item-row <tr>s exist in the department section.
    const itemRowMatches = html.match(/<tr>\s*<td class="c" style="height:19px;"><\/td>/g);
    expect(itemRowMatches).not.toBeNull();
    expect(itemRowMatches!.length).toBeGreaterThanOrEqual(4);
  });

  it("comments field shows empty string when undefined", () => {
    const data = sampleData({ comments: undefined });
    const html = renderIDP(data);

    // The template uses `data.comments ?? ""` so no "undefined" text should appear
    expect(html).not.toContain("undefined");
    // The comments span should be present but empty after the label
    expect(html).toContain("Comments:");
  });

  it('bookstore section contains "Actual Cost:" label', () => {
    const data = sampleData();
    const html = renderIDP(data);

    expect(html).toContain("Actual Cost:");
  });

  it("contains all three section sidebar labels", () => {
    const data = sampleData();
    const html = renderIDP(data);

    expect(html).toContain("Requesting Department Use");
    expect(html).toContain("Department Use");
    expect(html).toContain("Bookstore Use");
  });
});
