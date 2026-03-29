"use client";

import { useState, useCallback } from "react";
import { SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || isLoading) return;
      onSend(trimmed);
      setValue("");
    },
    [value, isLoading, onSend]
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <label htmlFor="chat-input" className="sr-only">Message</label>
      <Input
        id="chat-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask anything..."
        disabled={isLoading}
        className="text-sm"
      />
      <Button
        type="submit"
        size="icon"
        disabled={isLoading || !value.trim()}
        className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white"
        aria-label="Send message"
      >
        <SendIcon className="h-4 w-4" />
      </Button>
    </form>
  );
}
