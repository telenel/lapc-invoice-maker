// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { pdfStorage } from "@/domains/pdf/storage";

const TEST_DIR = join(process.cwd(), "data", "pdfs", "__test__");

describe("pdfStorage", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(join(TEST_DIR, "test.pdf"), Buffer.from("fake-pdf"));
  });

  afterAll(async () => {
    const { rm } = await import("fs/promises");
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("reads a PDF file and returns buffer", async () => {
    const buf = await pdfStorage.read(join(TEST_DIR, "test.pdf"));
    expect(buf.toString()).toBe("fake-pdf");
  });

  it("throws on non-existent file", async () => {
    await expect(pdfStorage.read(join(TEST_DIR, "nope.pdf"))).rejects.toThrow();
  });

  it("deletes a file safely", async () => {
    const path = join(TEST_DIR, "to-delete.pdf");
    await writeFile(path, Buffer.from("delete-me"));
    await pdfStorage.delete(path);
    await expect(readFile(path)).rejects.toThrow();
  });

  it("resolves a relative path within public/", () => {
    const abs = pdfStorage.resolvePublicPath("uploads/file.pdf");
    expect(abs).toContain("public");
    expect(abs).toContain("uploads/file.pdf");
  });
});
