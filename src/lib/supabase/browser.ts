"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

export interface RealtimeTokenResponse {
  token: string;
  userId: string;
  expiresAt: string;
}

let browserClient: SupabaseClient | null = null;
let tokenCache: RealtimeTokenResponse | null = null;
let tokenRequest: Promise<RealtimeTokenResponse> | null = null;

function isTokenFresh(token: RealtimeTokenResponse | null): boolean {
  if (!token) return false;
  const expiresAt = new Date(token.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt - Date.now() > 30_000;
}

async function fetchRealtimeToken(): Promise<RealtimeTokenResponse> {
  if (isTokenFresh(tokenCache)) {
    return tokenCache!;
  }

  if (!tokenRequest) {
    tokenRequest = fetch("/api/realtime/token", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch realtime token (${response.status})`);
        }
        const data = (await response.json()) as RealtimeTokenResponse;
        tokenCache = data;
        return data;
      })
      .finally(() => {
        tokenRequest = null;
      });
  }

  return tokenRequest;
}

export async function getSupabaseRealtimeContext(): Promise<{
  client: SupabaseClient;
  userId: string;
}> {
  const [client, token] = await Promise.all([
    getSupabaseBrowserClient(),
    fetchRealtimeToken(),
  ]);

  return {
    client,
    userId: token.userId,
  };
}

export function invalidateSupabaseRealtimeToken(): void {
  tokenCache = null;
}

function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabasePublicEnv();
  browserClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    accessToken: async () => {
      const token = await fetchRealtimeToken();
      return token.token;
    },
  });

  return browserClient;
}
