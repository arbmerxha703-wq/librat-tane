import { z } from "zod";
import { json, requirePasscode, serverError } from "@/lib/api";
import { readImage, VisionError } from "@/lib/vision";

export const maxDuration = 60;

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const requestSchema = z.object({
  image: z.string().min(100).max(6_000_000), // base64, no data: prefix
  mediaType: z.enum(MEDIA_TYPES),
});

const CoverSchema = z.object({
  found: z.boolean(),
  title: z.string(),
  author: z.string(),
});

const JSON_SHAPE = `{"found": true, "title": "string", "author": "string"}`;

const PROMPT = `This is a photo of a book cover (or spine) from a family home library in Albania.
Read the book's title and author exactly as printed, keeping the original language and accents (ë, ç, etc.).
Use normal capitalization (e.g. "Kronikë në gur", not "KRONIKË NË GUR").
Do not include subtitles, series names, publishers or translator names.
If you cannot read a title, set found to false and leave the fields empty.`;

export async function POST(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Fotografia nuk u pranua." }, 400);
  const { image, mediaType } = parsed.data;

  try {
    const cover = await readImage({
      image,
      mediaType,
      prompt: PROMPT,
      jsonShape: JSON_SHAPE,
      schema: CoverSchema,
      maxTokens: 4000,
    });
    if (!cover?.found || !cover.title.trim()) {
      return json({ error: "Nuk arrita ta lexoj kopertinën. Shkruajeni me dorë." }, 422);
    }
    return json({ title: cover.title.trim(), author: cover.author.trim() });
  } catch (err) {
    if (err instanceof VisionError) return json({ error: err.message }, err.status);
    return serverError(err);
  }
}
