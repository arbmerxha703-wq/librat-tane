import { bookSchema, json, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";
import { getLoans, setLoan, withLoans } from "@/lib/loans";

type Ctx = { params: Promise<{ id: string }> };

/** Edit a book (title, author, shelf, position, read). */
export async function PATCH(req: Request, { params }: Ctx) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const { id } = await params;
  const parsed = bookSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Të dhëna të pasakta." }, 400);
  try {
    const [book, loans] = await Promise.all([store.update(id, parsed.data), getLoans(store)]);
    return json({ book: withLoans([book], loans)[0] });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const { id } = await params;
  try {
    await store.remove(id);
    await setLoan(store, id, null);
    return json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
