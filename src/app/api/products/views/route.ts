import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/domains/shared/auth";
import {
  ProductViewDuplicateError,
  createProductView,
  listProductViews,
} from "@/domains/product/server-views";

export const dynamic = "force-dynamic";

const postBodySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  filter: z.record(z.string(), z.unknown()),
  columnPreferences: z
    .object({ visible: z.array(z.string()).max(24) })
    .optional()
    .nullable(),
});

export const GET = withAuth(async (_req, session) => {
  const userId = (session.user as { id?: string }).id;
  return NextResponse.json(await listProductViews(userId));
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json(
      { error: "Session missing user id" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const view = await createProductView({
      userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      filter: parsed.data.filter,
      columnPreferences: parsed.data.columnPreferences ?? null,
    });

    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    if (error instanceof ProductViewDuplicateError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
});
