import { SignJWT } from "jose";
import { getSupabaseJwtSecret } from "./env";

const REALTIME_TOKEN_TTL_SECONDS = 60 * 5;

export interface RealtimeTokenPayload {
  userId: string;
  role: string;
}

export interface RealtimeTokenResult {
  token: string;
  expiresAt: string;
  userId: string;
}

export async function mintSupabaseRealtimeToken(
  input: RealtimeTokenPayload
): Promise<RealtimeTokenResult> {
  const secret = new TextEncoder().encode(getSupabaseJwtSecret());
  const expiresAtUnix = Math.floor(Date.now() / 1000) + REALTIME_TOKEN_TTL_SECONDS;

  const token = await new SignJWT({
    role: "authenticated",
    aud: "authenticated",
    app_role: input.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("supabase")
    .setIssuedAt()
    .setExpirationTime(expiresAtUnix)
    .setSubject(input.userId)
    .sign(secret);

  return {
    token,
    userId: input.userId,
    expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
  };
}
