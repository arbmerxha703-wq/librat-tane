import "server-only";
import { createClient, type Session as SupabaseSession } from "@supabase/supabase-js";
import { json, serverError } from "./api";
import { getDb, getStore, MEMORY_OWNER, type Store } from "./store";

/** What the phone keeps to stay signed in. */
export type Session = { access_token: string; refresh_token: string; expires_at: number; email: string };

/**
 * A client for one sign-in call. Signing in changes the session a client sends with every query,
 * so this is never done on the shared service client.
 */
export function authClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function toSession(s: SupabaseSession): Session {
  return {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in,
    email: s.user.email ?? "",
  };
}

/** With `npm run dev:memory` there is no Supabase: any email and password sign in to one shared library. */
export const memorySession = (email: string): Session => ({
  access_token: "memory",
  refresh_token: "memory",
  expires_at: Math.floor(Date.now() / 1000) + 365 * 86_400,
  email,
});

/** The signed-in account behind a request's `Authorization: Bearer <token>`. */
export async function requireUser(req: Request): Promise<{ userId: string } | Response> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return json({ error: "Hyni në llogarinë tuaj." }, 401);
  if (!getDb()) return { userId: MEMORY_OWNER };
  const { data, error } = await authClient().auth.getUser(token);
  if (data.user) return { userId: data.user.id };
  // An expired or wrong token means "sign in again"; anything else is Supabase being unreachable.
  if (error && (error.status ?? 500) >= 500) return serverError(error);
  return json({ error: "Hyni përsëri në llogarinë tuaj." }, 401);
}

/** The signed-in account's own library, or the response to send back when nobody is signed in. */
export async function requireLibrary(req: Request): Promise<Store | Response> {
  const user = await requireUser(req);
  return user instanceof Response ? user : getStore(user.userId);
}
