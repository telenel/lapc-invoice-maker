"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChat, Chat, type UIMessage } from "@ai-sdk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareIcon,
  XIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";

const QUICK_ACTIONS = [
  { label: "Show pending invoices", text: "Show my pending invoices" },
  { label: "Today's events", text: "What events are happening today?" },
  { label: "Create a quote", text: "Help me create a new quote" },
] as const;

// Per-user Chat instances — shared with desktop sidebar via same key pattern
const chatInstances = new Map<string, Chat<UIMessage>>();
function getChatInstance(userId: string): Chat<UIMessage> {
  let instance = chatInstances.get(userId);
  if (!instance) {
    instance = new Chat<UIMessage>({ id: `laportal-chat-${userId}` });
    chatInstances.set(userId, instance);
  }
  return instance;
}

interface ChatMobileSheetProps {
  onClose: () => void;
}

export function ChatMobileSheet({ onClose }: ChatMobileSheetProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessionUserId =
    (session?.user as { id?: string } | undefined)?.id ?? "anonymous";
  const { messages, sendMessage, setMessages, status } = useChat({
    chat: getChatInstance(sessionUserId),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Handle navigate tool results
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
            onClose();
          }
        }
      }
    }
  }, [messages, router, onClose]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading]);

  // Lock body scroll while sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage],
  );

  const handleClear = useCallback(() => {
    chatInstances.delete(sessionUserId);
    setMessages([]);
  }, [setMessages, sessionUserId]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquareIcon className="h-5 w-5 text-purple-600" />
            <span className="text-base font-semibold">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <AnimatePresence initial={false}>
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
                    className="h-8 w-8"
                    title="Clear chat"
                    aria-label="Clear chat"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              aria-label="Close assistant"
            >
              <XIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {messages.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm px-4"
              >
                <MessageSquareIcon className="h-10 w-10 mb-3 opacity-50" />
                <p className="font-medium text-base">
                  Hi,{" "}
                  {session?.user?.name?.split(" ")[0] ?? "there"}!
                </p>
                <p className="mt-1 text-sm">
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
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="border-t px-4 py-3 shrink-0"
            >
              <div className="flex flex-wrap gap-2">
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
                      "rounded-full border px-3 py-1.5 text-sm",
                      "hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700",
                      "dark:hover:bg-purple-950 dark:hover:border-purple-700 dark:hover:text-purple-300",
                      "transition-colors disabled:opacity-50",
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
        <div className="border-t px-4 py-3 pb-safe shrink-0">
          <ChatInput onSend={handleSend} isLoading={isLoading} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
