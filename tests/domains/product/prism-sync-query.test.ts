import { describe, expect, it } from "vitest";
import { buildPrismPullPageQuery } from "@/domains/product/prism-sync";

describe("buildPrismPullPageQuery", () => {
  it("uses the real Prism DCC name columns for category metadata", () => {
    const sql = buildPrismPullPageQuery();

    expect(sql).toContain("LTRIM(RTRIM(dep.DeptName))");
    expect(sql).toContain("LTRIM(RTRIM(cls.ClassName))");
    expect(sql).toContain("LTRIM(RTRIM(cat.CatName))");
    expect(sql).not.toContain("LTRIM(RTRIM(dep.Name))");
    expect(sql).not.toContain("LTRIM(RTRIM(cls.Name))");
    expect(sql).not.toContain("LTRIM(RTRIM(cat.Name))");
  });

  it("filters Inventory to PIER + PCOP + PFS (LocationID IN 2, 3, 4)", () => {
    const sql = buildPrismPullPageQuery();
    expect(sql).toMatch(/inv\.LocationID\s+IN\s*\(\s*2\s*,\s*3\s*,\s*4\s*\)/);
    expect(sql).not.toMatch(/inv\.LocationID\s*=\s*@loc/);
    expect(sql).not.toMatch(/LocationID\s+IN\s*\([^)]*\b5\b/);
  });

  it("joins Prism ref tables and denormalizes label columns", () => {
    const sql = buildPrismPullPageQuery();
    expect(sql).toContain("TagType tag");
    expect(sql).toContain("RTRIM(tag.Description)");
    expect(sql).toContain("Item_Tax_Type itt");
    expect(sql).toContain("RTRIM(itt.Description)");
    expect(sql).toContain("PackageType pkg");
    expect(sql).toContain("Location loc");
    expect(sql).toContain("RTRIM(loc.Abbreviation)");
  });

  it("emits every Item + GM + Textbook global column we store in products", () => {
    const sql = buildPrismPullPageQuery();
    for (const col of [
      "gm.AlternateVendorID",
      "gm.MfgID",
      "i.StyleID",
      "i.fListPriceFlag",
      "gm.Size",
      "gm.SizeID",
      "gm.PackageType",
      "tb.BindingID",
      "tb.Imprint",
      "tb.Copyright",
      "tb.UsedSKU",
    ]) {
      expect(sql).toContain(col);
    }
  });

  it("joins status-code and binding ref tables for their labels", () => {
    const sql = buildPrismPullPageQuery();
    expect(sql).toContain("StatusCodeLabel");
    expect(sql).toContain("BindingLabel");
    expect(sql).toMatch(/LEFT JOIN InventoryStatusCodes sc ON sc\.InvStatusCodeID = inv\.StatusCodeID/);
    expect(sql).toMatch(/LEFT JOIN Binding bnd ON bnd\.BindingID = tb\.BindingID/);
  });
});
