import { beforeEach, describe, expect, it, vi } from "vitest";

const schedule = vi.fn();
const checkAndSendReminders = vi.fn();
const checkAndSendPaymentFollowUps = vi.fn();

vi.mock("node-cron", () => ({
  schedule,
}));

vi.mock("@/domains/event/reminders", () => ({
  checkAndSendReminders,
}));

vi.mock("@/domains/quote/follow-ups", () => ({
  checkAndSendPaymentFollowUps,
}));

describe("register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (
      globalThis as typeof globalThis & {
        __laportalCronRegistered?: boolean;
      }
    ).__laportalCronRegistered;
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.NODE_ENV = "production";
  });

  it("registers payment follow-ups in Los Angeles time", async () => {
    const { register } = await import("@/instrumentation");

    await register();

    expect(schedule).toHaveBeenCalledWith(
      "0 9 * * 1-5",
      expect.any(Function),
      { timezone: "America/Los_Angeles" },
    );
  });

  it("does not register cron jobs outside production", async () => {
    process.env.NODE_ENV = "development";
    const { register } = await import("@/instrumentation");

    await register();

    expect(schedule).not.toHaveBeenCalled();
  });
});
