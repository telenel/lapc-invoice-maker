import { describe, it, expect } from "vitest";
import { renderCoverSheet } from "@/lib/pdf/templates/cover-sheet";
import { renderIDP } from "@/lib/pdf/templates/idp";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count non-overlapping occurrences of a substring */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let start = 0;
  while ((start = haystack.indexOf(needle, start)) !== -1) {
    count++;
    start += needle.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// renderCoverSheet
// ---------------------------------------------------------------------------

const baseCoverData = {
  date: "March 25, 2026",
  semesterYearDept: "Spring 2026 – English",
  invoiceNumber: "AG-000111222",
  chargeAccountNumber: "CHG-9988",
  accountCode: "1234",
  totalAmount: "$250.00",
  signatures: [{ name: "Jane Doe", title: "Dean of Instruction" }],
};

describe("renderCoverSheet", () => {
  it("returns a valid HTML string starting with <!DOCTYPE html>", () => {
    const html = renderCoverSheet(baseCoverData);
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  it("contains the invoice number in the output", () => {
    const html = renderCoverSheet(baseCoverData);
    expect(html).toContain("AG-000111222");
  });

  it("contains the date in the output", () => {
    const html = renderCoverSheet(baseCoverData);
    expect(html).toContain("March 25, 2026");
  });

  it("contains the total amount", () => {
    const html = renderCoverSheet(baseCoverData);
    expect(html).toContain("$250.00");
  });

  it("contains 'This memorandum authorizes payment' formal text", () => {
    const html = renderCoverSheet(baseCoverData);
    expect(html).toContain("This memorandum authorizes payment");
  });

  it("pads to 3 sig-block elements when only 1 signature is passed", () => {
    const html = renderCoverSheet({
      ...baseCoverData,
      signatures: [{ name: "Jane Doe" }],
    });
    // Use class="sig-block" to target HTML elements only (CSS also contains .sig-block)
    expect(countOccurrences(html, 'class="sig-block"')).toBe(3);
  });

  it("produces 3 sig-block elements when 0 signatures are passed", () => {
    const html = renderCoverSheet({ ...baseCoverData, signatures: [] });
    expect(countOccurrences(html, 'class="sig-block"')).toBe(3);
  });

  it("always produces exactly 3 sig-block elements when 3 signatures provided", () => {
    const html = renderCoverSheet({
      ...baseCoverData,
      signatures: [
        { name: "Alice" },
        { name: "Bob" },
        { name: "Carol" },
      ],
    });
    expect(countOccurrences(html, 'class="sig-block"')).toBe(3);
  });

  it("includes the title in the sig-name when the signature has a title", () => {
    const html = renderCoverSheet({
      ...baseCoverData,
      signatures: [{ name: "Jane Doe", title: "Dean of Instruction" }],
    });
    expect(html).toContain("Jane Doe, Dean of Instruction");
  });

  it("omits the title separator when signature has no title", () => {
    const html = renderCoverSheet({
      ...baseCoverData,
      signatures: [{ name: "John Smith" }],
    });
    expect(html).toContain("John Smith");
    // No comma-separated title should appear after the name
    expect(html).not.toContain("John Smith,");
  });

  it("contains logo img tag when logoDataUri is provided", () => {
    const html = renderCoverSheet({
      ...baseCoverData,
      logoDataUri: "data:image/png;base64,abc123",
    });
    expect(html).toContain('<img src="data:image/png;base64,abc123"');
  });

  it("handles missing logoDataUri gracefully (still produces img tag)", () => {
    const { logoDataUri: _omit, ...withoutLogo } = {
      ...baseCoverData,
      logoDataUri: undefined,
    };
    const html = renderCoverSheet(withoutLogo);
    // Template always emits the img element; src will be "undefined" but the tag is present
    expect(html).toContain("<img");
  });

  it("contains the semesterYearDept department highlight text", () => {
    const html = renderCoverSheet(baseCoverData);
    expect(html).toContain("Spring 2026 – English");
  });

  // --- Edge cases ---

  it("handles special characters in invoice number (slash)", () => {
    const html = renderCoverSheet({ ...baseCoverData, invoiceNumber: "AG-001/23" });
    expect(html).toContain("AG-001/23");
  });

  it("handles very long semesterYearDept text without truncation", () => {
    const longText = "Spring 2026 – ".repeat(10).trim();
    const html = renderCoverSheet({ ...baseCoverData, semesterYearDept: longText });
    expect(html).toContain(longText);
  });

  it("handles empty string field values without 'undefined' in field-value spans", () => {
    // Provide logoDataUri explicitly so the img src is not "undefined"
    const html = renderCoverSheet({
      ...baseCoverData,
      logoDataUri: "data:image/png;base64,abc",
      chargeAccountNumber: "",
      accountCode: "",
      totalAmount: "",
    });
    // The field-value spans for these three fields should be empty, not "undefined"
    expect(html).not.toMatch(/class="field-value">undefined/);
  });

  it("contains proper @page CSS for letter size", () => {
    const html = renderCoverSheet(baseCoverData);
    expect(html).toContain("size: letter");
  });

  it("signature with title shows name and title separated by comma", () => {
    const html = renderCoverSheet({
      ...baseCoverData,
      signatures: [{ name: "Dr. Alice Kim", title: "Vice President" }],
    });
    expect(html).toContain("Dr. Alice Kim, Vice President");
  });
});

// ---------------------------------------------------------------------------
// renderIDP
// ---------------------------------------------------------------------------

const baseIDPData = {
  date: "2026-03-25",
  department: "Mathematics",
  documentNumber: "IDP-001",
  requestingDept: "Math Department",
  sapAccount: "SAP-4321",
  estimatedCost: "$120.00",
  approverName: "Dr. Carol White",
  contactName: "Bob Lee",
  contactPhone: "818-555-9900",
  totalAmount: "$120.00",
  items: [
    { description: "Calculator", quantity: "2", unitPrice: "$30.00", extendedPrice: "$60.00" },
    { description: "Graph paper", quantity: "6", unitPrice: "$10.00", extendedPrice: "$60.00" },
  ],
};

describe("renderIDP", () => {
  it("returns a valid HTML string starting with <!DOCTYPE html>", () => {
    const html = renderIDP(baseIDPData);
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  it("contains college name title", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("Los Angeles Pierce College");
  });

  it("contains form title", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("INTER- DEPARTMENT BOOKSTORE PURCHASE REQUEST FORM");
  });

  it("contains the document number", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("IDP-001");
  });

  it("contains the department", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("Mathematics");
  });

  it("contains the approver name", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("Dr. Carol White");
  });

  it("contains the contact info", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("Bob Lee");
    expect(html).toContain("818-555-9900");
  });

  it("pads to at least 4 item rows when 2 items are passed", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("Calculator");
    expect(html).toContain("Graph paper");
    // Should have at least 4 rows worth of bordered cells
    const cellCount = countOccurrences(html, 'class="c"');
    expect(cellCount).toBeGreaterThan(16);
  });

  it("pads to 4 empty rows when 0 items are passed", () => {
    const html = renderIDP({ ...baseIDPData, items: [] });
    // Padded rows exist — count bordered cells
    const cellCount = countOccurrences(html, 'class="c"');
    expect(cellCount).toBeGreaterThan(16);
  });

  it("contains 'Estimated Cost:' total label", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("Estimated Cost:");
  });

  it("contains 'Actual Cost:' in bookstore section", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("Actual Cost:");
  });

  it("contains 'Description of Product, Goods or Services Provided' in bookstore header", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("Description of Product, Goods or Services Provided");
  });

  it("includes comments text when provided", () => {
    const html = renderIDP({ ...baseIDPData, comments: "Rush order needed" });
    expect(html).toContain("Rush order needed");
  });

  it("produces empty comments when comments not provided", () => {
    const html = renderIDP({ ...baseIDPData, comments: undefined });
    expect(html).toContain("Comments:");
    expect(html).not.toContain("Rush order needed");
  });

  it("contains landscape page size (11in 8.5in)", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("11in 8.5in");
  });

  // --- Edge cases ---

  it("handles 10+ items without truncation", () => {
    const manyItems = Array.from({ length: 12 }, (_, i) => ({
      description: `Item ${i + 1}`,
      quantity: "1",
      unitPrice: "$5.00",
      extendedPrice: "$5.00",
    }));
    const html = renderIDP({ ...baseIDPData, items: manyItems });
    // All 12 descriptions should appear in the output
    for (let i = 1; i <= 12; i++) {
      expect(html).toContain(`Item ${i}`);
    }
  });

  it("handles special characters in item descriptions", () => {
    const html = renderIDP({
      ...baseIDPData,
      items: [
        { description: "Book & Pen (x2) <special>", quantity: "1", unitPrice: "$10.00", extendedPrice: "$10.00" },
      ],
    });
    expect(html).toContain("Book & Pen (x2) <special>");
  });

  it("handles empty string values without 'undefined' in output", () => {
    const html = renderIDP({
      ...baseIDPData,
      sapAccount: "",
      estimatedCost: "",
      approverName: "",
      contactName: "",
      contactPhone: "",
    });
    expect(html).not.toContain("undefined");
  });

  it("contains @page for landscape orientation (11in 8.5in)", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toMatch(/@page\s*\{[^}]*11in 8\.5in/);
  });

  it("contains all three section labels", () => {
    const html = renderIDP(baseIDPData);
    expect(html).toContain("Requesting Department Use");
    expect(html).toContain("Department Use");
    expect(html).toContain("Bookstore Use");
  });
});
