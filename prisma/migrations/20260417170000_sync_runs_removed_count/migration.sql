-- Records how many products rows were deleted during a pull because their
-- SKU no longer appears in the Pierce-stocked Inventory set. Nullable so
-- historical rows (pre-Pierce-scoping) stay valid.
ALTER TABLE "sync_runs" ADD COLUMN "removed_count" INTEGER;
