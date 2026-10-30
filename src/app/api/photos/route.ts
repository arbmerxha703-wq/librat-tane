import { z } from "zod";
import { json, photoPathSchema, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";

const requestSchema = z.object({ paths: z.array(photoPathSchema).min(1).max(20) });

/** Short-lived links for stored shelf / bookcase photos (the storage bucket is private). */
export async function POST(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Kërkesë e pasaktë." }, 400);
  try {
    return json({ urls: await store.photoUrls([...new Set(parsed.data.paths)]) });
  } catch (err) {
    return serverError(err);
  }
}
