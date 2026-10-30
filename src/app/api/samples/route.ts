import { json, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";
import { SAMPLE_BOOKS } from "@/lib/seed";

/** Add the example books. */
export async function POST(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  try {
    if ((await store.list()).some((b) => b.is_sample)) return json({ books: await store.list() });
    await store.addMany(SAMPLE_BOOKS, true);
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
