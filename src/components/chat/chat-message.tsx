"use client";

import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BotIcon, UserIcon } from "lucide-react";

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  const textParts = message.parts.filter((p) => p.type === "text");
  const text = textParts.map((p) => ("text" in p ? p.text : "")).join("");

  if (!text.trim()) return null;

  return (
    <div
      className={cn(
        "flex gap-2 text-sm",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-purple-600 text-white"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? (
          <UserIcon className="h-3.5 w-3.5" />
        ) : (
          <BotIcon className="h-3.5 w-3.5" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 leading-relaxed",
          isUser
            ? "bg-purple-600 text-white"
            : "bg-muted text-foreground"
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <MessageContent text={text} />
        </div>
      </div>
    </div>
  );
}

function MessageContent({ text }: { text: string }) {
  const router = useRouter();
  // Simple markdown-like rendering: bold, links, line breaks
  const parts = text.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*|\n)/g);

  return (
    <span>
      {parts.map((part, i) => {
        // Links: [text](url)
        const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
          const url = linkMatch[2];
          const isSafe = /^(https?:\/\/|\/)/i.test(url);
          const isInternal = url.startsWith("/");
          return isSafe ? (
            <a
              key={i}
              href={url}
              className="text-purple-400 underline hover:text-purple-300"
              onClick={isInternal ? (e) => { e.preventDefault(); router.push(url); } : undefined}
            >
              {linkMatch[1]}
            </a>
          ) : (
            <span key={i}>{linkMatch[1]}</span>
          );
        }
        // Bold: **text**
        const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
        if (boldMatch) {
          return <strong key={i}>{boldMatch[1]}</strong>;
        }
        // Line breaks
        if (part === "\n") {
          return <br key={i} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
