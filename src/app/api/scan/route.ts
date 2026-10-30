import { z } from "zod";
import { jpegSchema, json, serverError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
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
Write the title in normal sentence capitalization, not ALL CAPS.
Do not include subtitles, series names, publishers or translator names.
If you cannot read a title, set found to false and leave the fields empty.
Reply with ONLY a JSON object of this shape, no other text:
{"found": <true or false>, "title": "<title>", "author": "<author>"}`;

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Fotografia nuk u pranua." }, 400);

  try {
    const reply = await readImages({
      images: [{ data: parsed.data.image, mediaType: "image/jpeg" }],
      prompt: PROMPT,
      maxTokens: 300,
      patienceMs: 12_000,
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
