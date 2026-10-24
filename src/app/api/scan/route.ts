import { z } from "zod";
import { jpegSchema, json, requirePasscode, serverError } from "@/lib/api";
import { parseLenientJson, readImages, VisionError } from "@/lib/vision";

export const maxDuration = 60;

const requestSchema = z.object({ image: jpegSchema });

const CoverSchema = z.object({
  found: z.boolean(),
  title: z.string(),
  author: z.string(),
});

const PROMPT = `This is a photo of a book cover (or spine) from a family home library in Albania.
Read the book's title and author exactly as printed, keeping the original language and accents (ë, ç, etc.).
If what you read matches a real published book, write its correct official title and author.
Use normal capitalization (e.g. "Kronikë në gur", not "KRONIKË NË GUR").
Do not include subtitles, series names, publishers or translator names.
If you cannot read a title, set found to false and leave the fields empty.
Reply with ONLY this JSON object, no other text:
{"found": true, "title": "Kronikë në gur", "author": "Ismail Kadare"}`;

export async function POST(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Fotografia nuk u pranua." }, 400);

  try {
    const reply = await readImages({
      images: [{ data: parsed.data.image, mediaType: "image/jpeg" }],
      prompt: PROMPT,
      maxTokens: 300,
    });
    const cover = CoverSchema.safeParse(parseLenientJson(reply));
    if (!cover.success || !cover.data.found || !cover.data.title.trim()) {
      return json({ error: "Nuk arrita ta lexoj kopertinën. Shkruajeni me dorë." }, 422);
    }
    return json({ title: cover.data.title.trim(), author: cover.data.author.trim() });
  } catch (err) {
    if (err instanceof VisionError) return json({ error: err.message, retryAfter: err.retryAfter }, err.status);
    return serverError(err);
  }
}
