import { describe, expect, it } from "vitest";
import { buildPrismConfigFromEnv, prismSqlDateToUtc } from "@/lib/prism";

describe("buildPrismConfigFromEnv", () => {
  it("pins Prism datetime reads to UTC wall-clock mode for explicit downstream normalization", () => {
    const config = buildPrismConfigFromEnv({
      PRISM_SERVER: "winprism-la",
      PRISM_USER: "reader",
      PRISM_PASSWORD: "secret",
    });

    expect(config).not.toBeNull();
    expect(config?.options).toMatchObject({
      useUTC: true,
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    });
  });
});

describe("prismSqlDateToUtc", () => {
  it("reinterprets Prism datetime values as Los Angeles local time during daylight saving time", () => {
    const prismWallClock = new Date("2026-04-20T12:15:30.123Z");

    expect(prismSqlDateToUtc(prismWallClock).toISOString()).toBe("2026-04-20T19:15:30.123Z");
  });

  it("reinterprets Prism datetime values as Los Angeles local time during standard time", () => {
    const prismWallClock = new Date("2026-01-20T12:15:30.123Z");

    expect(prismSqlDateToUtc(prismWallClock).toISOString()).toBe("2026-01-20T20:15:30.123Z");
  });
});
