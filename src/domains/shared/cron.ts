import { type NextRequest, NextResponse } from "next/server";
import { getCronSecret } from "@/lib/job-scheduler";

type CronHandler = (req: NextRequest) => Promise<NextResponse>;

export function withCronAuth(handler: CronHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const configuredSecret = getCronSecret();
    if (!configuredSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 503 },
      );
    }

    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${configuredSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(req);
  };
}
