import { z } from "zod";
import { isbnSchema, json, serverError } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const HEADERS = { "user-agent": "BookNest home-library app (librat-tane.vercel.app)" };
const TIMEOUT = 8_000;

type Found = { title: string; author: string };

async function getJson(url: string): Promise<unknown | null> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT) }).catch(() => null);
  return res?.ok ? res.json().catch(() => null) : null;
}

const OpenLibraryEdition = z.object({
  title: z.string(),
  authors: z.array(z.object({ key: z.string() })).optional(),
  by_statement: z.string().optional(),
});

/** Open Library: free, no key; the edition lists author ids, each looked up for its name. */
async function fromOpenLibrary(isbn: string): Promise<Found | null> {
  const edition = OpenLibraryEdition.safeParse(await getJson(`https://openlibrary.org/isbn/${isbn}.json`));
  if (!edition.success) return null;
  const names = await Promise.all(
    (edition.data.authors ?? []).slice(0, 3).map(async ({ key }) => {
      const a = z.object({ name: z.string() }).safeParse(await getJson(`https://openlibrary.org${key}.json`));
      return a.success ? a.data.name : null;
    }),
  );
  const author = names.filter(Boolean).join(", ") || edition.data.by_statement?.replace(/^by\s+/i, "") || "";
  return { title: edition.data.title, author };
}

const GoogleBooks = z.object({
  items: z.array(z.object({ volumeInfo: z.object({ title: z.string(), authors: z.array(z.string()).optional() }) })).min(1),
});

/** Google Books: knows more books, but without a key it allows only a few lookups. */
async function fromGoogleBooks(isbn: string): Promise<Found | null> {
  const r = GoogleBooks.safeParse(await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`));
  if (!r.success) return null;
  const v = r.data.items[0].volumeInfo;
  return { title: v.title, author: (v.authors ?? []).join(", ") };
}

/** Title and author for a barcode (ISBN). `found: false` when no catalogue knows the book. */
export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  const isbn = isbnSchema.safeParse(new URL(req.url).searchParams.get("isbn"));
  if (!isbn.success) return json({ error: "Ky nuk është barkod libri (ISBN)." }, 400);
  try {
    const book = (await fromOpenLibrary(isbn.data)) ?? (await fromGoogleBooks(isbn.data));
    return json(book ? { found: true, isbn: isbn.data, ...book } : { found: false, isbn: isbn.data });
  } catch (err) {
    return serverError(err);
  }
}
