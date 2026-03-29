// src/lib/sse.ts

type SSEWriter = ReadableStreamDefaultController<Uint8Array>;

const connections = new Map<string, Set<SSEWriter>>();

export function subscribe(userId: string, controller: SSEWriter): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(controller);
}

export function unsubscribe(userId: string, controller: SSEWriter): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) connections.delete(userId);
}

export function publish(userId: string, data: unknown): void {
  const set = connections.get(userId);
  if (!set) return;
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  Array.from(set).forEach((controller) => {
    try {
      controller.enqueue(encoded);
    } catch {
      // Connection closed — clean up
      set.delete(controller);
    }
  });
}

export function publishAll(data: unknown): void {
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  connections.forEach((set) => {
    Array.from(set).forEach((controller) => {
      try {
        controller.enqueue(encoded);
      } catch {
        set.delete(controller);
      }
    });
  });
}

/** Fire-and-forget wrapper — SSE broadcast failures are non-critical */
export function safePublishAll(data: unknown): void {
  try {
    publishAll(data);
  } catch {
    /* SSE broadcast failure is non-critical */
  }
}
