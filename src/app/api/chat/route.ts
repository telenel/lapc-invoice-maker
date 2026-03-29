import { NextRequest } from "next/server";
import { streamText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildSystemPrompt } from "@/domains/chat/system-prompt";
import { buildTools } from "@/domains/chat/tools";
import type { ChatUser } from "@/domains/chat/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user: ChatUser = {
    id: (session.user as { id: string }).id,
    name: session.user.name ?? "User",
    role: (session.user as { role: string }).role,
  };

  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: buildSystemPrompt(user),
    messages,
    tools: buildTools(user),
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
