import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Realtime SSE stream retired; use Supabase Realtime client transport" },
    { status: 410 }
  );
}
