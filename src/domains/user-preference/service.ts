import type { Prisma } from "@/generated/prisma/client";
import { safePublish } from "@/lib/sse";
import * as userPreferenceRepository from "./repository";
import type { UserPreferenceResponse } from "./types";

type PreferenceRecord = Awaited<ReturnType<typeof userPreferenceRepository.findByUserAndKey>>;

function toPreferenceResponse(
  preference: NonNullable<PreferenceRecord>,
): UserPreferenceResponse {
  return {
    key: preference.key,
    value: preference.value as Prisma.JsonValue,
    updatedAt: preference.updatedAt.toISOString(),
  };
}

function publishPreferenceChange(userId: string, key: string, deleted = false) {
  safePublish(userId, {
    type: "user-preference-changed",
    key,
    deleted,
  });
}

export const userPreferenceService = {
  async get(userId: string, key: string): Promise<UserPreferenceResponse | null> {
    const preference = await userPreferenceRepository.findByUserAndKey(userId, key);
    if (!preference) {
      return null;
    }

    return toPreferenceResponse(preference);
  },

  async save(userId: string, key: string, value: unknown): Promise<UserPreferenceResponse> {
    const preference = await userPreferenceRepository.upsert(
      userId,
      key,
      value as Prisma.InputJsonValue,
    );

    publishPreferenceChange(userId, key);
    return toPreferenceResponse(preference);
  },

  async delete(userId: string, key: string): Promise<void> {
    await userPreferenceRepository.deleteByUserAndKey(userId, key);
    publishPreferenceChange(userId, key, true);
  },
};
