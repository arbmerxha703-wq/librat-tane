import { bookSchema, json, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";
import { getLoans, withLoans } from "@/lib/loans";

export async function GET(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  try {
    const [books, loans] = await Promise.all([store.list(), getLoans(store)]);
    return json({ books: withLoans(books, loans) });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const parsed = bookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Plotësoni titullin, raftin dhe vendin." }, 400);
  try {
    return json({ book: await store.add(parsed.data) }, 201);
  } catch (err) {
    return serverError(err);
  }
}
