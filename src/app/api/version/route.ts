import { readBuildMeta } from "@/lib/build-meta";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const buildMeta = await readBuildMeta();

  return NextResponse.json(
    {
      status: "ok",
      buildSha: buildMeta?.buildSha ?? process.env.BUILD_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
      buildTime: buildMeta?.buildTime ?? process.env.BUILD_TIME ?? process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
      publicEnv: {
        supabaseUrlConfigured: Boolean(buildMeta?.publicEnv?.supabaseUrlConfigured),
        supabaseAnonKeyConfigured: Boolean(buildMeta?.publicEnv?.supabaseAnonKeyConfigured),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
