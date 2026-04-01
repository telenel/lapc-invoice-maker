"use client";

import { Chat, type UIMessage } from "@ai-sdk/react";

const chatInstances = new Map<string, Chat<UIMessage>>();
let activeUserId: string | null = null;

export function getChatInstance(userId: string): Chat<UIMessage> {
  if (activeUserId && activeUserId !== userId) {
    chatInstances.clear();
  }

  activeUserId = userId;

  let instance = chatInstances.get(userId);
  if (!instance) {
    instance = new Chat<UIMessage>({ id: `laportal-chat-${userId}` });
    chatInstances.set(userId, instance);
  }
  return instance;
}

export function clearChatInstance(userId: string): void {
  chatInstances.delete(userId);

  if (activeUserId === userId) {
    activeUserId = null;
  }
}
