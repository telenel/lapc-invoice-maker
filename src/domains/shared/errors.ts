// src/domains/shared/errors.ts
import { toast } from "sonner";
import { ApiError } from "./types";

export function handleApiError(error: unknown, fallback = "Something went wrong") {
  const message = error instanceof ApiError ? error.message : fallback;
  toast.error(message);
  if (!(error instanceof ApiError)) {
    console.error(error);
  }
}
