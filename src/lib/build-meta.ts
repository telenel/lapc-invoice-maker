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

export async function readBuildMeta(): Promise<BuildMeta | null> {
  try {
    const file = path.join(process.cwd(), ".build-meta.json");
    const contents = await readFile(file, "utf8");
    return JSON.parse(contents) as BuildMeta;
  } catch {
    return null;
  }
}
