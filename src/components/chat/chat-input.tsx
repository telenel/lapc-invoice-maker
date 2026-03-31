"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SendIcon, MicIcon, MicOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as Record<string, unknown>;
  return (
    (win.SpeechRecognition as SpeechRecognitionConstructor | undefined) ??
    (win.webkitSpeechRecognition as SpeechRecognitionConstructor | undefined) ??
    null
  );
}

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [hasSpeechApi, setHasSpeechApi] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Check for Speech API availability after mount
  useEffect(() => {
    setHasSpeechApi(getSpeechRecognition() !== null);
  }, []);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      setValue(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || isLoading) return;
      // Stop listening if active
      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
      }
      onSend(trimmed);
      setValue("");
    },
    [value, isLoading, isListening, onSend],
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <Input
        id="chat-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isListening ? "Listening..." : "Ask anything\u2026"}
        disabled={isLoading}
        className={cn("text-sm", isListening && "border-red-400")}
      />
      {hasSpeechApi && (
        <Button
          type="button"
          size="icon"
          variant={isListening ? "destructive" : "outline"}
          onClick={toggleListening}
          disabled={isLoading}
          className={cn(
            "shrink-0",
            isListening && "animate-pulse",
          )}
          aria-label={isListening ? "Stop listening" : "Start voice input"}
        >
          {isListening ? (
            <MicOffIcon className="h-4 w-4" />
          ) : (
            <MicIcon className="h-4 w-4" />
          )}
        </Button>
      )}
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
