import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";
import { staffAccountNumberSchema } from "@/lib/validators";

export const GET = withAdmin(async () => {
  const codes = await adminService.listAccountCodes();
  return NextResponse.json(codes);
});

export const POST = withAdmin(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { staffId, ...rest } = body;

  if (!staffId) {
    return NextResponse.json({ error: "Staff member is required" }, { status: 400 });
  }

  const parsed = staffAccountNumberSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    const code = await adminService.createAccountCode({
      staffId,
      accountCode: parsed.data.accountCode,
      description: parsed.data.description,
    });
    return NextResponse.json(code, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 404) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json(
        { error: "This account code already exists for that staff member" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create account code" }, { status: 500 });
  }
});
