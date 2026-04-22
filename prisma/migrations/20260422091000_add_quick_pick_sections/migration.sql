-- CreateTable
CREATE TABLE "quick_pick_sections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "descriptionLike" TEXT,
    "dccIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "vendorIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "itemType" TEXT,
    "explicitSkus" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "includeDiscontinued" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_pick_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quick_pick_sections_slug_key" ON "quick_pick_sections"("slug");
