import { z } from "zod";
import { bookSchema, json, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";

const bulkSchema = z.object({ books: z.array(bookSchema).min(1).max(200) });

/** Save many books at once (used after photographing a whole shelf). */
export async function POST(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Çdo libër duhet të ketë titull, raft dhe vend." }, 400);
  try {
    return json({ books: await store.addMany(parsed.data.books) }, 201);
  } catch (err) {
    return serverError(err);
  }
}
