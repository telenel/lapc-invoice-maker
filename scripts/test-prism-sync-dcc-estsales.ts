/**
 * Verifies the DCC + Inventory_EstSales extensions of the prism-sync pull.
 * Picks a known Pierce-stocked SKU, runs a single-row sync, asserts the new
 * columns populate. Safe to re-run.
 */
import "dotenv/config";
import { getPrismPool } from "../src/lib/prism";
import { getSupabaseAdminClient } from "../src/lib/supabase/admin";

const SAMPLE_SKU = Number(process.env.SAMPLE_SKU ?? "0");

async function main(): Promise<void> {
  if (!SAMPLE_SKU) {
    throw new Error("Set SAMPLE_SKU to a known Pierce-stocked SKU before running.");
  }

  const pool = await getPrismPool();
  const prism = await pool.request().input("sku", SAMPLE_SKU).query<{
    Department: number | null;
    Class: number | null;
    Category: number | null;
    DeptName: string | null;
    ClassName: string | null;
    CatName: string | null;
    EstSalesCalc: number | null;
  }>(`
    SELECT
      dcc.Department, dcc.Class, dcc.Category,
      dep.Name AS DeptName, cls.Name AS ClassName, cat.Name AS CatName,
      es.EstSalesCalc
    FROM Item i
    LEFT JOIN DeptClassCat dcc ON i.DCCID = dcc.DCCID
    LEFT JOIN DCC_Department dep ON dcc.Department = dep.Department
    LEFT JOIN DCC_Class      cls ON dcc.Department = cls.Department AND dcc.Class = cls.Class
    LEFT JOIN DCC_Category   cat ON dcc.Department = cat.Department AND dcc.Class = cat.Class AND dcc.Category = cat.Category
    LEFT JOIN (
      SELECT SKU, EstSalesCalc,
             ROW_NUMBER() OVER (PARTITION BY SKU ORDER BY CalculationDate DESC) AS rn
      FROM Inventory_EstSales WHERE LocationID = 2
    ) es ON es.SKU = i.SKU AND es.rn = 1
    WHERE i.SKU = @sku
  `);
  if (prism.recordset.length === 0) {
    throw new Error(`SKU ${SAMPLE_SKU} not found in Prism Item table.`);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("sku, dept_num, class_num, cat_num, dept_name, class_name, cat_name, est_sales_calc")
    .eq("sku", SAMPLE_SKU)
    .maybeSingle();
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  if (!data) {
    throw new Error(`SKU ${SAMPLE_SKU} not found in Supabase products. Run a sync first.`);
  }

  const prismRow = prism.recordset[0];
  const mismatches: string[] = [];
  if (data.dept_num !== prismRow.Department) mismatches.push(`dept_num ${data.dept_num} != ${prismRow.Department}`);
  if (data.class_num !== prismRow.Class) mismatches.push(`class_num ${data.class_num} != ${prismRow.Class}`);
  if (data.cat_num !== prismRow.Category) mismatches.push(`cat_num ${data.cat_num} != ${prismRow.Category}`);
  if ((data.dept_name ?? "") !== (prismRow.DeptName?.trim() ?? "")) mismatches.push(`dept_name "${data.dept_name}" != "${prismRow.DeptName}"`);
  const prismEst = prismRow.EstSalesCalc != null ? Number(prismRow.EstSalesCalc) : null;
  const supaEst = data.est_sales_calc != null ? Number(data.est_sales_calc) : null;
  if (prismEst !== supaEst) mismatches.push(`est_sales_calc ${supaEst} != ${prismEst}`);

  if (mismatches.length > 0) {
    console.error(`FAIL for SKU ${SAMPLE_SKU}:\n  - ${mismatches.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`OK — SKU ${SAMPLE_SKU} DCC + EstSales match between Prism and Supabase.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
