import { z } from "zod";
import { json, requirePasscode, serverError } from "@/lib/api";
import { setLoan } from "@/lib/loans";

type Ctx = { params: Promise<{ id: string }> };

const loanSchema = z.object({ to: z.string().trim().min(1).max(80) });

/** "E dhashë hua": record who borrowed the book, from today. */
export async function PUT(req: Request, { params }: Ctx) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const { id } = await params;
  const parsed = loanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Shkruani kujt ia dhatë librin." }, 400);
  try {
    const loan = { to: parsed.data.to, at: new Date().toISOString() };
    await setLoan(id, loan);
    return json({ loan });
  } catch (err) {
    return serverError(err);
  }
}

/** "U kthye": the book is back on its shelf. */
export async function DELETE(req: Request, { params }: Ctx) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    await setLoan(id, null);
    return json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
