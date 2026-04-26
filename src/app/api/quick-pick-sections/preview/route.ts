import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quickPickSectionPreviewSchema } from "@/domains/quick-pick-sections/schemas";
import { previewQuickPickSection } from "@/domains/quick-pick-sections/server";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = quickPickSectionPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const preview = await previewQuickPickSection({
    ...parsed.data,
    descriptionLike: parsed.data.descriptionLike ?? "",
    itemType: parsed.data.itemType ?? "",
  });

  return NextResponse.json(preview);
});
