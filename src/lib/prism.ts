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

let poolPromise: Promise<ConnectionPool> | null = null;

function getConfig(): sql.config | null {
  const server = process.env.PRISM_SERVER;
  const user = process.env.PRISM_USER;
  const password = process.env.PRISM_PASSWORD;
  const database = process.env.PRISM_DATABASE ?? "prism";

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
    },
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  };
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
