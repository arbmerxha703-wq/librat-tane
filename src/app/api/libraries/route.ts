import { z } from "zod";
import { json, libraryIdSchema, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";
import { setLibraries } from "@/lib/libraries";

const listSchema = z.object({
  libraries: z
    .array(z.object({ id: libraryIdSchema, name: z.string().trim().min(1).max(40) }))
    .min(1)
    .max(30)
    .refine((list) => new Set(list.map((l) => l.id)).size === list.length),
});

/** Saves the whole list of libraries (add, rename, remove). A library that still has books can't be removed. */
export async function PUT(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const parsed = listSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Shkruani një emër për bibliotekën." }, 400);
  const { libraries } = parsed.data;
  try {
    const kept = new Set(libraries.map((l) => l.id));
    if ((await store.list()).some((b) => !kept.has(b.library_id ?? "main"))) {
      return json({ error: "Kjo bibliotekë ka ende libra. Kalojini librat në një bibliotekë tjetër më parë." }, 409);
    }
    await setLibraries(store, libraries);
    return json({ libraries });
  } catch (err) {
    return serverError(err);
  }
}
