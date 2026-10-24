import { bookSchema, json, requirePasscode, serverError } from "@/lib/api";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const { id } = await params;
  const parsed = bookSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Të dhëna të pasakta." }, 400);
  try {
    return json({ book: await getStore().update(id, parsed.data) });
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
    return json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
