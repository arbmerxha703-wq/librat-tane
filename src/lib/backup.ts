import "server-only";
import { getDb } from "./store";

const BUCKET = "photos";
const FOLDER = "backups";
const KEEP = 12;
const EVERY_DAYS = 6;
const PAGE = 1000;

async function allRows(table: string): Promise<unknown[]> {
  const db = getDb()!;
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/**
 * A copy of every account's books and settings, saved as JSON in the private bucket
 * ("backups/2026-11-15.json") about once a week; the 12 newest are kept. Supabase's free plan
 * makes no backups of its own, so this is what brings back books deleted by mistake.
 * Returns the file written, or null when the newest copy is still recent.
 */
export async function backupIfDue(now = new Date()): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const storage = db.storage.from(BUCKET);

  const { data: files, error } = await storage.list(FOLDER, { limit: 1000, sortBy: { column: "name", order: "desc" } });
  if (error) throw error;
  const copies = (files ?? []).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f.name));
  const newest = copies[0] ? new Date(`${copies[0].name.slice(0, 10)}T00:00:00Z`) : null;
  if (newest && now.getTime() - newest.getTime() < EVERY_DAYS * 86_400_000) return null;

  const [books, settings] = await Promise.all([allRows("books"), allRows("app_settings")]);
  const name = `${now.toISOString().slice(0, 10)}.json`;
  const body = JSON.stringify({ made_at: now.toISOString(), books, app_settings: settings });
  const { error: upError } = await storage.upload(`${FOLDER}/${name}`, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (upError) throw upError;

  const old = [name, ...copies.map((f) => f.name).filter((n) => n !== name)].slice(KEEP);
  if (old.length) await storage.remove(old.map((n) => `${FOLDER}/${n}`));
  return name;
}
