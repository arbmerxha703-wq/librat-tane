import { z } from "zod";
import { bookSchema, json, requirePasscode, serverError } from "@/lib/api";
import { getStore } from "@/lib/store";

const bulkSchema = z.object({ books: z.array(bookSchema).min(1).max(200) });

/** Save many books at once (used after photographing a whole shelf). */
export async function POST(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Çdo libër duhet të ketë titull, raft dhe vend." }, 400);
  try {
    return json({ books: await getStore().addMany(parsed.data.books) }, 201);
  } catch (err) {
    return serverError(err);
  }
}
