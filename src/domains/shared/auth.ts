// src/domains/shared/auth.ts
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { AuthSession } from "./types";

type RouteContext = { params: Promise<Record<string, string>> };
type AuthHandler = (req: NextRequest, session: AuthSession, ctx?: RouteContext) => Promise<NextResponse>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest, ctx?: RouteContext): Promise<NextResponse> => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, session as unknown as AuthSession, ctx);
  };
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function withAdmin(handler: AuthHandler) {
  return async (req: NextRequest, ctx?: RouteContext): Promise<NextResponse> => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (session.user as unknown as { role: string }).role;
    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, session as unknown as AuthSession, ctx);
  };
}
