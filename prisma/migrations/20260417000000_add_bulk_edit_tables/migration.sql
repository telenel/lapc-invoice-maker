-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "owner_user_id" TEXT,
    "name" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_edit_runs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operator_user_id" TEXT NOT NULL,
    "operator_display" TEXT NOT NULL,
    "selection" JSONB NOT NULL,
    "transform" JSONB NOT NULL,
    "affected_skus" INTEGER[],
    "sku_count" INTEGER NOT NULL,
    "pricing_delta_cents" BIGINT NOT NULL DEFAULT 0,
    "had_district_changes" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "bulk_edit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "triggered_by" TEXT NOT NULL,
    "scanned_count" INTEGER,
    "updated_count" INTEGER,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_searches_owner_user_id_name_idx" ON "saved_searches"("owner_user_id", "name");

-- CreateIndex
CREATE INDEX "bulk_edit_runs_created_at_idx" ON "bulk_edit_runs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "bulk_edit_runs_operator_user_id_created_at_idx" ON "bulk_edit_runs"("operator_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs"("started_at" DESC);

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_edit_runs" ADD CONSTRAINT "bulk_edit_runs_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

