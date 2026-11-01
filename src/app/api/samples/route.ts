import { json, libraryIdSchema, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";
import { SAMPLE_BOOKS } from "@/lib/seed";
import { MAIN_LIBRARY } from "@/lib/types";

/** Add the example books, to the library in `?library=<id>` (default the first). */
export async function POST(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const lib = libraryIdSchema.default(MAIN_LIBRARY).safeParse(new URL(req.url).searchParams.get("library") ?? undefined);
  if (!lib.success) return json({ error: "Kërkesë e pasaktë." }, 400);
  try {
    if ((await store.list()).some((b) => b.is_sample)) return json({ books: await store.list() });
    await store.addMany(SAMPLE_BOOKS.map((b) => ({ ...b, library_id: lib.data })), true);
    return json({ books: await store.list() });
  } catch (err) {
    return serverError(err);
  }
}

/** Remove only the example books; real books are untouched. */
export async function DELETE(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  try {
    await store.removeSamples();
    return json({ books: await store.list() });
  } catch (err) {
    return serverError(err);
  }
}
