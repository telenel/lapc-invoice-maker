import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("deploy and migration guardrails", () => {
  it("recreates the products baseline before later raw SQL migrations extend it", () => {
    const migrationDirs = fs
      .readdirSync(path.join(repoRoot, "prisma/migrations"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const bootstrapName = "20260416999999_products_table_baseline";
    const bootstrapSql = readRepoFile(`prisma/migrations/${bootstrapName}/migration.sql`);

    expect(migrationDirs.indexOf(bootstrapName)).toBeGreaterThan(-1);
    expect(migrationDirs.indexOf(bootstrapName)).toBeLessThan(
      migrationDirs.indexOf("20260417000001_extend_products_for_bulk_edit"),
    );
    expect(bootstrapSql).toContain('CREATE TABLE IF NOT EXISTS "products"');
    expect(bootstrapSql).toContain('ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;');
    expect(bootstrapSql).toContain("rolname = 'authenticated'");
    expect(bootstrapSql).toContain('CREATE POLICY "Authenticated users can read products"');
  });

  it("adds the saved_searches slug constraint before preset upserts rely on ON CONFLICT", () => {
    const migrationDirs = fs
      .readdirSync(path.join(repoRoot, "prisma/migrations"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const constraintName = "20260418070000_saved_searches_slug_unique_constraint";
    const constraintSql = readRepoFile(`prisma/migrations/${constraintName}/migration.sql`);

    expect(migrationDirs.indexOf(constraintName)).toBeGreaterThan(
      migrationDirs.indexOf("20260418064543_saved_searches_presets_schema"),
    );
    expect(migrationDirs.indexOf(constraintName)).toBeLessThan(
      migrationDirs.indexOf("20260418070856_seed_products_page_presets"),
    );
    expect(constraintSql).toContain('ADD CONSTRAINT "saved_searches_slug_key" UNIQUE ("slug")');
  });

  it("keeps existing products_with_derived view columns in place before appending new ones", () => {
    const sql = readRepoFile("prisma/migrations/20260418153000_products_derived_accuracy_and_margin/migration.sql");

    const stockCoverageIdx = sql.indexOf("END AS stock_coverage_days");
    const trendIdx = sql.indexOf("END AS trend_direction");
    const effectiveLastSaleIdx = sql.indexOf("AS effective_last_sale_date");
    const aggregatesReadyIdx = sql.indexOf("AS aggregates_ready");
    const marginRatioIdx = sql.indexOf("AS margin_ratio");

    expect(stockCoverageIdx).toBeGreaterThan(-1);
    expect(trendIdx).toBeGreaterThan(stockCoverageIdx);
    expect(effectiveLastSaleIdx).toBeGreaterThan(trendIdx);
    expect(aggregatesReadyIdx).toBeGreaterThan(effectiveLastSaleIdx);
    expect(marginRatioIdx).toBeGreaterThan(aggregatesReadyIdx);
  });

  it("adds CI migration validation and keeps container startup migration-free by default", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const entrypoint = readRepoFile("scripts/docker-entrypoint.sh");
    const deployScript = readRepoFile("scripts/deploy-webhook.sh");

    expect(ciWorkflow).toContain("migration_check:");
    expect(ciWorkflow).toContain("Bootstrap Supabase-like roles for raw SQL migrations");
    expect(ciWorkflow).toContain("npx prisma migrate deploy");

    expect(entrypoint).toContain("DEFAULT_CMD='node server.js'");
    expect(entrypoint).toContain('RUN_PRISMA_MIGRATIONS_ON_START:-0');

    expect(deployScript).toContain("run_migration_preflight()");
    expect(deployScript).toContain("migration preflight failed");
  });
});
