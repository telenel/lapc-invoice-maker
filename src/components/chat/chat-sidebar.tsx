"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChat, Chat } from "@ai-sdk/react";
import {
  MessageSquareIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";

const STORAGE_KEY = "lapc-chat-open";

const QUICK_ACTIONS = [
  { label: "Show pending invoices", text: "Show my pending invoices" },
  { label: "Today's events", text: "What events are happening today?" },
  { label: "Create a quote", text: "Help me create a new quote" },
];

// Singleton Chat instance — survives component re-mounts during navigation
let chatInstance: Chat | null = null;
function getChatInstance(): Chat {
  if (!chatInstance) {
    chatInstance = new Chat({ id: "lapc-chat" });
  }
  return chatInstance;
}

export function ChatSidebar() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  // Read initial open state from localStorage after mount
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setIsOpen(stored === null ? true : stored === "true");
  }, []);

  const { messages, sendMessage, setMessages, status } = useChat({
    chat: getChatInstance(),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Handle navigate tool results — track processed calls to avoid re-navigation
  const processedNavs = useRef(new Set<string>());
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (
          "toolCallId" in part &&
          "output" in part &&
          part.state === "output-available" &&
          part.output &&
          typeof part.output === "object" &&
          "action" in part.output &&
          (part.output as { action: string }).action === "navigate" &&
          "path" in part.output
        ) {
          const callId = (part as { toolCallId: string }).toolCallId;
          if (!processedNavs.current.has(callId)) {
            processedNavs.current.add(callId);
            router.push((part.output as { path: string }).path);
          }
        }
      }
    }
  }, [messages, router]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage]
  );

  const handleClear = useCallback(() => {
    chatInstance = null;
    setMessages([]);
  }, [setMessages]);

  // Don't render until session is loaded and we know open state
  if (sessionStatus !== "authenticated" || !session?.user || isOpen === null) {
    return null;
  }

  // Collapsed state: thin strip
  if (!isOpen) {
    return (
      <div className="hidden lg:flex flex-col items-center py-4 border-l bg-background print:hidden h-full sticky top-0" data-print-hide>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleOpen}
          className="h-8 w-8"
          title="Open AI assistant"
        >
          <PanelRightOpenIcon className="h-4 w-4" />
        </Button>
        <div className="mt-2">
          <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Open state: full sidebar
  return (
    <div
      className="hidden lg:flex w-80 shrink-0 flex-col border-l bg-background print:hidden h-full sticky top-0"
      data-print-hide
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium">LAPC Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-7 w-7"
              title="Clear chat"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleOpen}
            className="h-7 w-7"
            title="Close assistant"
          >
            <PanelRightCloseIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm px-4">
            <MessageSquareIcon className="h-8 w-8 mb-2 opacity-50" />
            <p className="font-medium">
              Hi, {session.user.name?.split(" ")[0] ?? "there"}!
            </p>
            <p className="mt-1 text-xs">
              Ask me about invoices, quotes, events, or staff.
            </p>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {messages.length === 0 && (
        <div className="border-t px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.text)}
                disabled={isLoading}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  "hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700",
                  "dark:hover:bg-purple-950 dark:hover:border-purple-700 dark:hover:text-purple-300",
                  "transition-colors disabled:opacity-50"
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t px-3 py-2">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
