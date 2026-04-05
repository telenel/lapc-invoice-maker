// IMPORTANT: Next.js only inlines NEXT_PUBLIC_* env vars in client bundles
// when accessed as literal strings (e.g. process.env.NEXT_PUBLIC_SUPABASE_URL).
// Dynamic access like process.env[name] is NOT replaced at build time and
// returns undefined in the browser. Public env vars MUST use literal access.

export function hasSupabasePublicEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function hasSupabaseAdminEnv(): boolean {
  return Boolean(hasSupabasePublicEnv() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured");
  }
  return { url, anonKey };
}

export function getSupabaseAdminEnv() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return {
    ...getSupabasePublicEnv(),
    serviceRoleKey,
  };
}

export function getSupabaseJwtSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not configured");
  }
  return secret;
}
