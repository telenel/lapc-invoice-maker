import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscribe, unsubscribe } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      subscribe(userId, controller);

      controller.enqueue(encoder.encode(": connected\n\n"));

      pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          if (pingInterval) clearInterval(pingInterval);
        }
      }, 30_000);

      req.signal.addEventListener("abort", () => {
        if (pingInterval) clearInterval(pingInterval);
        if (controllerRef) {
          unsubscribe(userId, controllerRef);
          try { controllerRef.close(); } catch { /* already closed */ }
        }
      });
    },
    cancel() {
      if (pingInterval) clearInterval(pingInterval);
      if (controllerRef) unsubscribe(userId, controllerRef);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
