import { json, requirePasscode, serverError } from "@/lib/api";
import { SAMPLE_BOOKS } from "@/lib/seed";
import { getStore } from "@/lib/store";

/** Add the example books. */
export async function POST(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  try {
    const store = getStore();
    if ((await store.list()).some((b) => b.is_sample)) return json({ books: await store.list() });
    await store.addMany(SAMPLE_BOOKS, true);
    return json({ books: await store.list() });
  } catch (err) {
    return serverError(err);
  }
}

/** Remove only the example books; real books are untouched. */
export async function DELETE(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  try {
    const store = getStore();
    await store.removeSamples();
    return json({ books: await store.list() });
  } catch (err) {
    return serverError(err);
  }
}
