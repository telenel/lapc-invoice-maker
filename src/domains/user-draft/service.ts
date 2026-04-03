import type { Prisma } from "@/generated/prisma/client";
import { safePublish } from "@/lib/sse";
import * as userDraftRepository from "./repository";
import type { UserDraftResponse } from "./types";

const DRAFT_EXPIRY_DAYS = 7;

type DraftRecord = Awaited<ReturnType<typeof userDraftRepository.findByUserAndRouteKey>>;

function toDraftResponse(
  draft: NonNullable<DraftRecord>,
): UserDraftResponse {
  return {
    routeKey: draft.routeKey,
    data: draft.data as Prisma.JsonValue,
    savedAt: draft.savedAt.toISOString(),
    expiresAt: draft.expiresAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

function draftExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}

function getDraftExpiryDate(savedAt: Date): Date {
  return new Date(savedAt.getTime() + DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export const userDraftService = {
  async get(userId: string, routeKey: string): Promise<UserDraftResponse | null> {
    const draft = await userDraftRepository.findByUserAndRouteKey(userId, routeKey);
    if (!draft) {
      return null;
    }

    if (draftExpired(draft.expiresAt)) {
      await userDraftRepository.deleteByUserAndRouteKey(userId, routeKey);
      return null;
    }

    return toDraftResponse(draft);
  },

  async save(userId: string, routeKey: string, data: unknown): Promise<UserDraftResponse> {
    const savedAt = new Date();
    const expiresAt = getDraftExpiryDate(savedAt);
    const draft = await userDraftRepository.upsert(
      userId,
      routeKey,
      data as Prisma.InputJsonValue,
      savedAt,
      expiresAt,
    );

    safePublish(userId, {
      type: "draft-changed",
      routeKey,
      savedAt: draft.savedAt.toISOString(),
    });

    return toDraftResponse(draft);
  },

  async delete(userId: string, routeKey: string): Promise<void> {
    await userDraftRepository.deleteByUserAndRouteKey(userId, routeKey);

    safePublish(userId, {
      type: "draft-changed",
      routeKey,
      deleted: true,
    });
  },
};
