import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { isEmailConfigured } from "@/lib/email";

export const GET = withAuth(async () => {
  return NextResponse.json({ available: isEmailConfigured() });
});
