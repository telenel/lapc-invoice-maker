import type { Prisma } from "@/generated/prisma/client";

export interface UserDraftResponse<T = Prisma.JsonValue> {
  routeKey: string;
  data: T;
  savedAt: string;
  expiresAt: string;
  updatedAt: string;
}

export interface SaveUserDraftInput<T = unknown> {
  routeKey: string;
  data: T;
}
