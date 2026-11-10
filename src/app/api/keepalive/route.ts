import { json } from "@/lib/api";
import { backupIfDue } from "@/lib/backup";
import { pingDatabase } from "@/lib/store";

/**
 * Called once a day by Vercel Cron (see vercel.json). Supabase's free plan pauses a project after
 * a week without activity; one tiny query a day keeps the catalog awake. About once a week it also
 * saves a backup of all books (src/lib/backup.ts). Returns no data.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return json({ ok: false }, 401);
  try {
    await pingDatabase();
  } catch (err) {
    console.error("[keepalive]", err);
    return json({ ok: false }, 500);
  }
  try {
    const backup = await backupIfDue();
    return json({ ok: true, backup });
  } catch (err) {
    // The database is awake either way; a failed backup is retried tomorrow.
    console.error("[backup]", err);
    return json({ ok: true, backup: "failed" });
  }
}
