import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      buildSha: process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
