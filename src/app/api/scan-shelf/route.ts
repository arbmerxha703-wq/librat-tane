import { z } from "zod";
import { jpegSchema, json, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";
import { extractTileRows, mergeTiles, SHELF_PROMPT, TILES } from "@/lib/shelfScan";
import { readImages, VisionError } from "@/lib/vision";

export const maxDuration = 120;

const requestSchema = z.object({
  /** The whole shelf, kept so people can later see where a book stands. */
  photo: jpegSchema,
  /** Left, middle and right parts, each padded to a square; widthFrac = share of the square the photo fills. */
  tiles: z.array(z.object({ image: jpegSchema, widthFrac: z.number().min(0.05).max(1) })).length(TILES.length),
});

export async function POST(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Fotografia nuk u pranua." }, 400);
  const { photo, tiles } = parsed.data;

  try {
    const reply = await readImages({
      images: tiles.map((t) => ({ data: t.image, mediaType: "image/jpeg" as const })),
      prompt: SHELF_PROMPT,
      maxTokens: 950,
      patienceMs: 25_000,
    });
    const books = mergeTiles(extractTileRows(reply), tiles.map((t) => t.widthFrac));
    if (books.length === 0) {
      return json({ error: "Nuk arrita të shoh libra në këtë foto. Provoni një foto më të afërt dhe me më shumë dritë." }, 422);
    }

    // The photo is a bonus: if saving it fails, the list of books is still useful.
    let photoPath: string | null = null;
    let photoUrl: string | null = null;
    try {
      photoPath = await store.savePhoto("shelves", photo);
      photoUrl = (await store.photoUrls([photoPath]))[photoPath] ?? null;
    } catch (err) {
      console.error("[scan-shelf] photo not saved", err);
    }

    return json({ books, photoPath, photoUrl });
  } catch (err) {
    if (err instanceof VisionError) return json({ error: err.message, retryAfter: err.retryAfter }, err.status);
    return serverError(err);
  }
}
