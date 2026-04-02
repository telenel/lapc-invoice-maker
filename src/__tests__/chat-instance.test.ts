import { beforeEach, describe, expect, it, vi } from "vitest";

const chatConstructor = vi.fn();

vi.mock("@ai-sdk/react", () => ({
  Chat: class MockChat {
    id: string;

    constructor({ id }: { id: string }) {
      this.id = id;
      chatConstructor(id);
    }
  },
}));

describe("chat-instance cache", () => {
  beforeEach(async () => {
    vi.resetModules();
    chatConstructor.mockClear();
  });

  it("keeps only the active user's chat instance resident per tab", async () => {
    const { getChatInstance } = await import("@/components/chat/chat-instance");

    const firstUserChat = getChatInstance("user-a");
    const sameUserChat = getChatInstance("user-a");
    const secondUserChat = getChatInstance("user-b");
    const newFirstUserChat = getChatInstance("user-a");

    expect(firstUserChat).toBe(sameUserChat);
    expect(secondUserChat).not.toBe(firstUserChat);
    expect(newFirstUserChat).not.toBe(firstUserChat);
    expect(chatConstructor).toHaveBeenCalledTimes(3);
  });
});
