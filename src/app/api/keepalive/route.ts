import { json } from "@/lib/api";
import { getStore } from "@/lib/store";

/**
 * Called once a day by Vercel Cron (see vercel.json). Supabase's free plan pauses a project after
 * a week without activity; one tiny query a day keeps the catalog awake. Returns no data.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return json({ ok: false }, 401);
  try {
    await getStore().ping();
    return json({ ok: true });
  } catch (err) {
    console.error("[keepalive]", err);
    return json({ ok: false }, 500);
  }
}
