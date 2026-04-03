import type { Prisma } from "@/generated/prisma/client";

export interface UserPreferenceResponse<T = Prisma.JsonValue> {
  key: string;
  value: T;
  updatedAt: string;
}

export interface SaveUserPreferenceInput<T = unknown> {
  key: string;
  value: T;
}
