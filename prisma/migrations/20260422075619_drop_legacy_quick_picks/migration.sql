-- DropForeignKey
ALTER TABLE "user_quick_picks" DROP CONSTRAINT "user_quick_picks_user_id_fkey";

-- DropTable
DROP TABLE "quick_pick_items";

-- DropTable
DROP TABLE "user_quick_picks";
