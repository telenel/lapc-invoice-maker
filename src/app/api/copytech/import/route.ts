import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { copyTechImportService } from "@/domains/copytech-import/service";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 1 * 1024 * 1024;

function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return name.endsWith(".csv") || type === "text/csv" || type === "application/csv" || type === "text/plain";
}

async function readCsvFile(req: NextRequest): Promise<{ csvText: string } | { response: NextResponse }> {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return { response: NextResponse.json({ error: "Expected multipart/form-data with a CSV file field named file" }, { status: 400 }) };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { response: NextResponse.json({ error: "No CSV file provided. Upload the file in the form field named file." }, { status: 400 }) };
  }

  if (!isCsvFile(file)) {
    return { response: NextResponse.json({ error: "Only CSV files are allowed" }, { status: 400 }) };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { response: NextResponse.json({ error: "CSV file size exceeds 1MB limit" }, { status: 400 }) };
  }

  return { csvText: await file.text() };
}

export const GET = withAuth(async () => {
  return NextResponse.json(copyTechImportService.getCsvFormat(), {
    headers: { "Cache-Control": "private, no-store" },
  });
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const mode = req.nextUrl.searchParams.get("mode") ?? "preview";
  if (mode !== "preview" && mode !== "commit") {
    return NextResponse.json({ error: "mode must be preview or commit" }, { status: 400 });
  }

  const readResult = await readCsvFile(req);
  if ("response" in readResult) return readResult.response;

  try {
    if (mode === "commit") {
      const result = await copyTechImportService.commit(readResult.csvText, session.user.id);
      return NextResponse.json(result, {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const preview = await copyTechImportService.preview(readResult.csvText);
    return NextResponse.json(preview, {
      status: preview.errors.length > 0 ? 422 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "VALIDATION") {
      return NextResponse.json(
        { error: "CSV has validation errors", preview: "preview" in err ? err.preview : undefined },
        { status: 422 },
      );
    }
    console.error("POST /api/copytech/import failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

