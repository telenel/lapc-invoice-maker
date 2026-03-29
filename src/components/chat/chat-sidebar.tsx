"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChat, Chat, type UIMessage } from "@ai-sdk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareIcon,
  ChevronsRightIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";

const STORAGE_KEY = "lapc-chat-open";
const SIDEBAR_WIDTH = 320;

const QUICK_ACTIONS = [
  { label: "Show pending invoices", text: "Show my pending invoices" },
  { label: "Today's events", text: "What events are happening today?" },
  { label: "Create a quote", text: "Help me create a new quote" },
];

// Singleton Chat instance — survives component re-mounts during navigation
let chatInstance: Chat<UIMessage> | null = null;
function getChatInstance(): Chat<UIMessage> {
  if (!chatInstance) {
    chatInstance = new Chat<UIMessage>({ id: "lapc-chat" });
  }
  return chatInstance;
}

const sidebarSpring = { type: "spring" as const, stiffness: 300, damping: 30 };

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

  return (
    <div className="hidden lg:flex shrink-0 h-screen print:hidden relative" data-print-hide>
      {/* Toggle handle — centered on left edge */}
      <motion.button
        onClick={toggleOpen}
        className={cn(
          "absolute left-0 top-1/2 -translate-x-1/2 z-10",
          "flex items-center justify-center",
          "w-8 h-16 rounded-full",
          "bg-muted/80 backdrop-blur-sm border border-border/50 shadow-md",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-accent hover:shadow-lg",
        )}
        initial={false}
        animate={{ y: "-50%", scale: 1 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.95 }}
        title={isOpen ? "Close assistant" : "Open assistant"}
        aria-label={isOpen ? "Close assistant" : "Open assistant"}
      >
        <motion.div
          initial={false}
          animate={{ rotate: isOpen ? 0 : 180 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronsRightIcon className="h-5 w-5" />
        </motion.div>
      </motion.button>

      {/* Sidebar with spring animation */}
      <motion.div
        className="flex flex-col border-l bg-background overflow-hidden"
        initial={false}
        animate={{ width: isOpen ? SIDEBAR_WIDTH : 0 }}
        transition={sidebarSpring}
      >
        {/* Fixed-width inner so content doesn't reflow during animation */}
        <div style={{ width: SIDEBAR_WIDTH }} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquareIcon className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">LAPC Assistant</span>
            </div>
            <AnimatePresence>
              {messages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClear}
                    className="h-7 w-7"
                    title="Clear chat"
                    aria-label="Clear chat"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            <AnimatePresence mode="wait">
              {messages.length === 0 && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm px-4"
                >
                  <MessageSquareIcon className="h-8 w-8 mb-2 opacity-50" />
                  <p className="font-medium">
                    Hi, {session.user.name?.split(" ")[0] ?? "there"}!
                  </p>
                  <p className="mt-1 text-xs">
                    Ask me about invoices, quotes, events, or staff.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChatMessage message={message} />
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce motion-reduce:animate-none [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce motion-reduce:animate-none [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce motion-reduce:animate-none [animation-delay:300ms]" />
                  </span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Quick actions */}
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="border-t px-3 py-2 shrink-0"
              >
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action, i) => (
                    <motion.button
                      key={action.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
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
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="border-t px-3 py-2 shrink-0">
            <ChatInput onSend={handleSend} isLoading={isLoading} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
