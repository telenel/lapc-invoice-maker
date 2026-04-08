import { readFile } from "fs/promises";
import path from "path";

type BuildMeta = {
  buildSha?: string | null;
  buildTime?: string | null;
  publicEnv?: {
    supabaseUrlConfigured?: boolean;
    supabaseAnonKeyConfigured?: boolean;
  } | null;
};

function normalizeString(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return undefined;
}

function readRuntimeBuildMeta(): BuildMeta | null {
  const buildSha = normalizeString(process.env.BUILD_SHA)
    ?? normalizeString(process.env.NEXT_PUBLIC_BUILD_SHA);
  const buildTime = normalizeString(process.env.BUILD_TIME)
    ?? normalizeString(process.env.NEXT_PUBLIC_BUILD_TIME);

  const supabaseUrlConfigured = Boolean(
    normalizeString(process.env.NEXT_PUBLIC_SUPABASE_URL),
  );
  const supabaseAnonKeyConfigured = Boolean(
    normalizeString(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );

  const hasStableBuildSha = buildSha !== null && buildSha !== "dev";
  const hasStableBuildTime = buildTime !== null && buildTime !== "unknown";

  if (!hasStableBuildSha && !hasStableBuildTime) {
    return null;
  }

  return {
    buildSha,
    buildTime,
    publicEnv: {
      supabaseUrlConfigured,
      supabaseAnonKeyConfigured,
    },
  };
}

function parseFileBuildMeta(raw: unknown): BuildMeta | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as {
    buildSha?: unknown;
    buildTime?: unknown;
    publicEnv?: {
      supabaseUrlConfigured?: unknown;
      supabaseAnonKeyConfigured?: unknown;
    } | null;
  };

  return {
    buildSha: typeof candidate.buildSha === "string" ? candidate.buildSha : null,
    buildTime: typeof candidate.buildTime === "string" ? candidate.buildTime : null,
    publicEnv: {
      supabaseUrlConfigured: normalizeBoolean(candidate.publicEnv?.supabaseUrlConfigured) ?? false,
      supabaseAnonKeyConfigured: normalizeBoolean(candidate.publicEnv?.supabaseAnonKeyConfigured) ?? false,
    },
  };
}

export async function readBuildMeta(): Promise<BuildMeta | null> {
  const runtimeBuildMeta = readRuntimeBuildMeta();
  if (runtimeBuildMeta) {
    return runtimeBuildMeta;
  }

  try {
    const file = path.join(process.cwd(), ".build-meta.json");
    const contents = await readFile(file, "utf8");
    return parseFileBuildMeta(JSON.parse(contents));
  } catch {
    return null;
  }
}
