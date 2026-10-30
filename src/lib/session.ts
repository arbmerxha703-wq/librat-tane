/**
 * The signed-in account on this phone. Supabase sessions last an hour; the refresh token swaps them
 * for new ones, so people stay signed in until they press "Dil".
 */
export type Session = { access_token: string; refresh_token: string; expires_at: number; email: string };

const KEY = "booknest-session";
// Used when the phone blocks storage (private mode): signed in for this visit only.
let inMemory: Session | null = null;
const listeners = new Set<() => void>();

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return inMemory;
  }
}

export const getSession = load;

export function setSession(session: Session | null) {
  inMemory = session;
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable — kept in memory above.
  }
  listeners.forEach((fn) => fn());
}

/** Called whenever someone signs in or out (or the session ends). Returns an unsubscribe function. */
export function onSessionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let refreshing: Promise<Session | null> | null = null;

/**
 * A new session from the refresh token. One at a time: Supabase rotates refresh tokens, so two
 * requests refreshing together would make the second one fail. Throws only when offline.
 */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= (async () => {
    const current = load();
    if (!current) return null;
    let res: Response;
    try {
      res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "refresh", refresh_token: current.refresh_token }),
        cache: "no-store",
      });
    } catch {
      throw new Error("offline");
    }
    // Another tab may have refreshed meanwhile; its session is just as good.
    const latest = load();
    if (res.status === 401) {
      if (latest && latest.refresh_token !== current.refresh_token) return latest;
      setSession(null);
      return null;
    }
    if (!res.ok) throw new Error("server");
    const { session } = (await res.json()) as { session: Session };
    setSession({ ...session, email: session.email || current.email });
    return load();
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** A token for the next request, refreshed when it has less than a minute left. */
export async function accessToken(): Promise<string | null> {
  const s = load();
  if (!s) return null;
  if (s.expires_at * 1000 - Date.now() > 60_000) return s.access_token;
  return (await refreshSession())?.access_token ?? null;
}

function emailFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.email === "string" ? payload.email : "";
  } catch {
    return "";
  }
}

let recoveryLink: "reset" | "expired" | null | undefined;

/**
 * The "forgot password" email opens the app with the session in the address (#access_token=…&type=recovery).
 * Signs in with it and returns "reset" so the app asks for a new password, or "expired" for an old link.
 * Reads the address once; later calls return the same answer.
 */
export function takeRecoveryLink(): "reset" | "expired" | null {
  if (recoveryLink !== undefined) return recoveryLink;
  recoveryLink = null;
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get("type") === "recovery" && hash.get("access_token") && hash.get("refresh_token")) {
    const access = hash.get("access_token")!;
    setSession({
      access_token: access,
      refresh_token: hash.get("refresh_token")!,
      expires_at: Number(hash.get("expires_at")) || Math.floor(Date.now() / 1000) + 3600,
      email: emailFromToken(access),
    });
    recoveryLink = "reset";
  } else if (hash.get("error_code")) {
    recoveryLink = "expired";
  }
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  return recoveryLink;
}
