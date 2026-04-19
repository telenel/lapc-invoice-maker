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
});
