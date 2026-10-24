import { bookSchema, json, requirePasscode, serverError } from "@/lib/api";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  try {
    return json({ books: await getStore().list() });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const parsed = bookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Plotësoni titullin, raftin dhe vendin." }, 400);
  try {
    return json({ book: await getStore().add(parsed.data) }, 201);
  } catch (err) {
    return serverError(err);
  }
}
