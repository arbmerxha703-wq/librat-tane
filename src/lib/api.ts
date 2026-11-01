import "server-only";
import { z } from "zod";

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function serverError(err: unknown): Response {
  console.error(err);
  return json({ error: "Diçka shkoi keq. Provoni përsëri." }, 500);
}

/** Storage paths the app itself creates: "<owner>/shelves/1f…c2.jpg", or "shelves/…" from before accounts. */
export const photoPathSchema = z.string().regex(/^([0-9a-f-]{36}\/)?(shelves|map)\/[0-9a-f-]{36}\.jpg$/);

/** A base64 JPEG without the data: prefix (phones send ≤1600px images, well under this). */
export const jpegSchema = z.string().min(100).max(4_000_000);

const edge = z.number().int().min(0).max(1000).nullable().optional();

/** "main", or the id given to a library added later. */
export const libraryIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

const bookFields = {
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().max(200),
  shelf: z.string().trim().min(1).max(50),
  position: z.coerce.number().int().min(0).max(100000),
  is_read: z.boolean(),
  library_id: libraryIdSchema.optional(),
  photo_path: photoPathSchema.nullable().optional(),
  x0: edge,
  x1: edge,
};

export const bookSchema = z.object({
  ...bookFields,
  author: bookFields.author.default(""),
  is_read: bookFields.is_read.default(false),
});

/** Only the fields sent are changed: no defaults here, or marking a book read would also clear its author. */
export const bookPatchSchema = z.object(bookFields).partial();
