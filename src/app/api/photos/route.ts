import { z } from "zod";
import { json, photoPathSchema, requirePasscode, serverError } from "@/lib/api";
import { getStore } from "@/lib/store";

const requestSchema = z.object({ paths: z.array(photoPathSchema).min(1).max(20) });

/** Short-lived links for stored shelf / bookcase photos (the storage bucket is private). */
export async function POST(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Kërkesë e pasaktë." }, 400);
  try {
    return json({ urls: await getStore().photoUrls([...new Set(parsed.data.paths)]) });
  } catch (err) {
    return serverError(err);
  }
}
