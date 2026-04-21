/**
 * Prism SQL Server connection client.
 *
 * Connects directly to the WinPRISM/Prism SQL Server (winprism-la) over the LACCD
 * intranet for write operations on the POS catalog. Read operations should
 * continue to use the Supabase `products` mirror — this module is for writes
 * (item creation, deletion, updates) and reference lookups (vendors, DCCs, etc.).
 *
 * IMPORTANT: This server is intranet-only (172.25.x.x). The hosted production
 * VPS (laportal.montalvo.io) cannot reach it. `isPrismAvailable()` returns
 * false in that environment so the UI can hide write features cleanly.
 */
import sql, { type ConnectionPool, type IResult } from "mssql";
import { LOS_ANGELES_TIME_ZONE, zonedDateTimeToUtc } from "./date-utils";

let poolPromise: Promise<ConnectionPool> | null = null;

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function prismSqlDateToUtc(date: Date, timeZone = LOS_ANGELES_TIME_ZONE): Date {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid Prism datetime");
  }

  const normalized = zonedDateTimeToUtc(
    `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`,
    `${padDatePart(date.getUTCHours())}:${padDatePart(date.getUTCMinutes())}`,
    timeZone,
  );
  normalized.setUTCSeconds(normalized.getUTCSeconds() + date.getUTCSeconds(), date.getUTCMilliseconds());
  return normalized;
}

export function buildPrismConfigFromEnv(env: Record<string, string | undefined> = process.env): sql.config | null {
  const server = env.PRISM_SERVER;
  const user = env.PRISM_USER;
  const password = env.PRISM_PASSWORD;
  const database = env.PRISM_DATABASE ?? "prism";

  if (!server || !user || !password) return null;

  return {
    server,
    user,
    password,
    database,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      // Prism stores LA wall-clock datetimes without timezone metadata.
      // Keep the raw clock fields intact so the sync layer can normalize them explicitly.
      useUTC: true,
    },
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  };
}

function getConfig(): sql.config | null {
  return buildPrismConfigFromEnv();
}

/** Returns true if Prism env vars are configured. Does not actually connect. */
export function isPrismConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Get (or lazily initialize) the singleton connection pool. Throws if env is
 * not configured. Callers should check `isPrismConfigured()` first if they
 * want to gracefully degrade.
 */
export async function getPrismPool(): Promise<ConnectionPool> {
  if (poolPromise) return poolPromise;

  const config = getConfig();
  if (!config) {
    throw new Error(
      "Prism is not configured in this environment (missing PRISM_SERVER/USER/PASSWORD env vars).",
    );
  }

  poolPromise = sql
    .connect(config)
    .then((pool) => {
      pool.on("error", (err) => {
        console.error("[prism] pool error:", err);
        // Force re-init on next call
        poolPromise = null;
      });
      return pool;
    })
    .catch((err) => {
      // Reset so next attempt can retry
      poolPromise = null;
      throw err;
    });

  return poolPromise;
}

/** Probe whether Prism is reachable. Returns { available, version? , error? }. */
export async function probePrism(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  if (!isPrismConfigured()) {
    return { available: false, error: "Not configured" };
  }
  try {
    const pool = await getPrismPool();
    const result = await pool.request().query<{ version: string }>(
      "SELECT @@VERSION AS version",
    );
    return { available: true, version: result.recordset[0]?.version };
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Re-export sql types for downstream callers. */
export { sql };
export type { IResult, ConnectionPool };
