import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join, resolve } from "path";

const PDF_DIR = join(process.cwd(), "data", "pdfs");

export const pdfStorage = {
  async ensureDir(): Promise<string> {
    await mkdir(PDF_DIR, { recursive: true });
    return PDF_DIR;
  },

  pathFor(filename: string): string {
    return join(PDF_DIR, filename);
  },

  async read(absolutePath: string): Promise<Buffer> {
    return readFile(absolutePath);
  },

  async write(absolutePath: string, data: Buffer): Promise<void> {
    const dir = absolutePath.substring(0, absolutePath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(absolutePath, data);
  },

  async delete(absolutePath: string): Promise<void> {
    await unlink(absolutePath);
  },

  async safeDelete(absolutePath: string): Promise<void> {
    try {
      await unlink(absolutePath);
    } catch {
      // File may not exist
    }
  },

  resolvePublicPath(relativePath: string): string {
    const resolved = resolve(process.cwd(), "public", relativePath);
    if (!resolved.startsWith(resolve(process.cwd(), "public"))) {
      throw new Error("Path traversal detected");
    }
    return resolved;
  },
};
