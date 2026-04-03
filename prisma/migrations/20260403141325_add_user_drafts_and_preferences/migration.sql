-- CreateTable
CREATE TABLE "user_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "route_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_drafts_user_id_expires_at_idx" ON "user_drafts"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_drafts_user_id_route_key_key" ON "user_drafts"("user_id", "route_key");

-- CreateIndex
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key_key" ON "user_preferences"("user_id", "key");

-- AddForeignKey
ALTER TABLE "user_drafts" ADD CONSTRAINT "user_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
