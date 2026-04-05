import { describe, it, expect, vi, beforeEach } from "vitest";

describe("supabase env", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getSupabasePublicEnv uses literal process.env access for client inlining", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");

    const { getSupabasePublicEnv } = await import("@/lib/supabase/env");
    const result = getSupabasePublicEnv();

    expect(result.url).toBe("https://test.supabase.co");
    expect(result.anonKey).toBe("test-anon-key");
  });

  it("getSupabasePublicEnv throws when vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { getSupabasePublicEnv } = await import("@/lib/supabase/env");

    expect(() => getSupabasePublicEnv()).toThrow("must be configured");
  });

  it("getSupabaseJwtSecret throws when missing", async () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "");

    const { getSupabaseJwtSecret } = await import("@/lib/supabase/env");

    expect(() => getSupabaseJwtSecret()).toThrow("not configured");
  });
});
