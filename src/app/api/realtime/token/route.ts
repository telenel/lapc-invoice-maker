import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { mintSupabaseRealtimeToken } from "@/lib/supabase/realtime-token";

export const GET = withAuth(async (_req, session) => {
  try {
    const token = await mintSupabaseRealtimeToken({
      userId: session.user.id,
      role: session.user.role,
    });

    return NextResponse.json(token, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("GET /api/realtime/token failed:", error);
    return NextResponse.json(
      { error: "Realtime token unavailable" },
      { status: 503 }
    );
  }
});
