import { bookSchema, json, requirePasscode, serverError } from "@/lib/api";
import { getLoans, setLoan, withLoans } from "@/lib/loans";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** Edit a book (title, author, shelf, position, read). */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const { id } = await params;
  const parsed = bookSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Të dhëna të pasakta." }, 400);
  try {
    const [book, loans] = await Promise.all([getStore().update(id, parsed.data), getLoans()]);
    return json({ book: withLoans([book], loans)[0] });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    await getStore().remove(id);
    await setLoan(id, null);
    return json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
