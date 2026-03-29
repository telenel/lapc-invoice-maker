import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildSystemPrompt } from "@/domains/chat/system-prompt";
import { buildTools } from "@/domains/chat/tools";
import type { ChatUser } from "@/domains/chat/types";
import { checkRateLimit } from "@/lib/rate-limit";

// 30 messages per minute per user to prevent cost exhaustion
const CHAT_RATE_LIMIT = { maxAttempts: 30, windowMs: 60 * 1000 };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { allowed, retryAfterMs } = checkRateLimit(`chat:${userId}`, CHAT_RATE_LIMIT);
  if (!allowed) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((retryAfterMs ?? 0) / 1000)) },
    });
  }

  const user: ChatUser = {
    id: userId,
    name: session.user.name ?? "User",
    role: (session.user as { role: string }).role,
  };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { messages } =
    body && typeof body === "object" ? (body as { messages?: unknown }) : {};

  if (!Array.isArray(messages)) {
    return new Response("Invalid messages format", { status: 400 });
  }

  const tools = buildTools(user);

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(messages, { tools });
  } catch {
    return new Response("Invalid messages format", { status: 400 });
  }

  const tools = buildTools(user);

  const modelMessages = await convertToModelMessages(messages, { tools });

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: buildSystemPrompt(user),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
