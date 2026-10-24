import { z } from "zod";
import { json, requirePasscode, serverError } from "@/lib/api";
import { readImage, VisionError } from "@/lib/vision";

// Reading 20–40 spines carefully can take a while.
export const maxDuration = 120;

const requestSchema = z.object({
  image: z.string().min(100).max(8_000_000), // base64, no data: prefix
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const ShelfSchema = z.object({
  books: z.array(
    z.object({
      title: z.string(),
      author: z.string(),
      readable: z.boolean(),
    }),
  ),
});

const JSON_SHAPE = `{"books": [{"title": "string", "author": "string", "readable": true}]}`;

const PROMPT = `This photo shows books standing on a shelf in a family home library in Albania.
List EVERY book on the main shelf in the photo, strictly from LEFT to RIGHT, in the exact order they stand.
The order matters: it is used to number each book's position on the shelf.

For each book:
- Read the title and author from the spine (or cover, if it faces out), exactly as printed. Spines are often rotated; read them anyway.
- Keep the original language and accents (ë, ç, etc.). Use normal capitalization ("Kronikë në gur", not "KRONIKË NË GUR").
- Leave out publisher names, logos, series names and volume numbers that are not part of the title.
- If you can see that a book is there but cannot read its title, still include it with readable: false and an empty title,
  so the numbering of the books after it stays correct. If you can read only part of it, give your best reading and set readable: false.
- If the author is not on the spine, use the author only if you are sure who wrote the book; otherwise leave it empty.

Ignore things that are not books (decorations, boxes, photos). If several shelves are visible, list only the shelf that is most prominent in the photo.`;

export async function POST(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Fotografia nuk u pranua." }, 400);
  const { image, mediaType } = parsed.data;

  try {
    const result = await readImage({
      image,
      mediaType,
      prompt: PROMPT,
      jsonShape: JSON_SHAPE,
      schema: ShelfSchema,
      maxTokens: 16000,
    });
    const books = result?.books ?? [];
    if (books.length === 0) {
      return json({ error: "Nuk arrita të shoh libra në këtë foto. Provoni një foto më të afërt dhe me më shumë dritë." }, 422);
    }
    return json({
      books: books.map((b) => ({ title: b.title.trim(), author: b.author.trim(), readable: b.readable && !!b.title.trim() })),
    });
  } catch (err) {
    if (err instanceof VisionError) return json({ error: err.message }, err.status);
    return serverError(err);
  }
}
