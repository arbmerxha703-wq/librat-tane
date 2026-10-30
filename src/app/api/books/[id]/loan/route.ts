import { z } from "zod";
import { json, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";
import { setLoan } from "@/lib/loans";

type Ctx = { params: Promise<{ id: string }> };

const loanSchema = z.object({ to: z.string().trim().min(1).max(80) });

/** "E dhashë hua": record who borrowed the book, from today. */
export async function PUT(req: Request, { params }: Ctx) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const { id } = await params;
  const parsed = loanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Shkruani kujt ia dhatë librin." }, 400);
  try {
    const loan = { to: parsed.data.to, at: new Date().toISOString() };
    await setLoan(store, id, loan);
    return json({ loan });
  } catch (err) {
    return serverError(err);
  }
}

/** "U kthye": the book is back on its shelf. */
export async function DELETE(req: Request, { params }: Ctx) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const { id } = await params;
  try {
    await setLoan(store, id, null);
    return json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
