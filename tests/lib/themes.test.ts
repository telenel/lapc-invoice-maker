import { describe, it, expect } from "vitest";
import { themes } from "@/lib/themes";

describe("themes", () => {
  it("themes array is not empty", () => {
    expect(themes.length).toBeGreaterThan(0);
  });

  it("each theme has value and label properties", () => {
    for (const theme of themes) {
      expect(theme).toHaveProperty("value");
      expect(theme).toHaveProperty("label");
      expect(typeof theme.value).toBe("string");
      expect(typeof theme.label).toBe("string");
    }
  });

  it("includes 'light', 'dark', and 'system' values", () => {
    const values = themes.map((t) => t.value);
    expect(values).toContain("light");
    expect(values).toContain("dark");
    expect(values).toContain("system");
  });

  it("includes all 4 Catppuccin theme values", () => {
    const values = themes.map((t) => t.value);
    expect(values).toContain("theme-latte");
    expect(values).toContain("theme-frappe");
    expect(values).toContain("theme-macchiato");
    expect(values).toContain("theme-mocha");
  });

  it("has no duplicate values", () => {
    const values = themes.map((t) => t.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
