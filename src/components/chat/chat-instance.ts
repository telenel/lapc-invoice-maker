"use client";

import { Chat, type UIMessage } from "@ai-sdk/react";

const chatInstances = new Map<string, Chat<UIMessage>>();

export function getChatInstance(userId: string): Chat<UIMessage> {
  let instance = chatInstances.get(userId);
  if (!instance) {
    instance = new Chat<UIMessage>({ id: `laportal-chat-${userId}` });
    chatInstances.set(userId, instance);
  }
  return instance;
}

export function clearChatInstance(userId: string): void {
  chatInstances.delete(userId);
}
