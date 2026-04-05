import { describe, expect, it, vi, beforeEach } from "vitest";

const readBuildMeta = vi.fn();

vi.mock("@/lib/build-meta", () => ({
  readBuildMeta,
}));

describe("getPlatformHealth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.JOB_SCHEDULER;
    delete process.env.CRON_SECRET;
  });

  it("reports build and runtime Supabase status separately", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.JOB_SCHEDULER = "supabase";
    process.env.CRON_SECRET = "secret";
    readBuildMeta.mockResolvedValue({
      publicEnv: {
        supabaseUrlConfigured: true,
        supabaseAnonKeyConfigured: false,
      },
    });

    const { getPlatformHealth } = await import("@/lib/platform-health");
    const health = await getPlatformHealth();

    expect(health.supabase.runtimePublicEnv).toBe(true);
    expect(health.supabase.runtimeAdminEnv).toBe(true);
    expect(health.supabase.buildPublicEnv).toEqual({
      supabaseUrlConfigured: true,
      supabaseAnonKeyConfigured: false,
    });
    expect(health.scheduler).toEqual({
      mode: "supabase",
      confirmed: false,
      cronSecretConfigured: true,
    });
  });

  it("defaults missing build metadata to false flags", async () => {
    readBuildMeta.mockResolvedValue(null);

    const { getPlatformHealth } = await import("@/lib/platform-health");
    const health = await getPlatformHealth();

    expect(health.supabase.runtimePublicEnv).toBe(false);
    expect(health.supabase.runtimeAdminEnv).toBe(false);
    expect(health.supabase.buildPublicEnv).toEqual({
      supabaseUrlConfigured: false,
      supabaseAnonKeyConfigured: false,
    });
    expect(health.scheduler).toEqual({
      mode: "app",
      confirmed: false,
      cronSecretConfigured: false,
    });
  });
});
