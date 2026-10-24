import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const sha = (s: string) => createHash("sha256").update(s).digest();

/** Returns an error response when the shared passcode header is missing or wrong. */
export function requirePasscode(req: Request): Response | null {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return json({ error: "APP_PASSCODE nuk është vendosur në server." }, 500);
  const given = req.headers.get("x-passcode") ?? "";
  if (!timingSafeEqual(sha(given), sha(expected))) {
    return json({ error: "Kodi është i gabuar." }, 401);
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function serverError(err: unknown): Response {
  console.error(err);
  return json({ error: "Diçka shkoi keq. Provoni përsëri." }, 500);
}

/** Storage paths the app itself creates, e.g. "shelves/1f…c2.jpg". */
export const photoPathSchema = z.string().regex(/^(shelves|map)\/[0-9a-f-]{36}\.jpg$/);

/** A base64 JPEG without the data: prefix (phones send ≤1600px images, well under this). */
export const jpegSchema = z.string().min(100).max(4_000_000);

const edge = z.number().int().min(0).max(1000).nullable().optional();

export const bookSchema = z.object({
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().max(200).default(""),
  shelf: z.string().trim().min(1).max(50),
  position: z.coerce.number().int().min(0).max(100000),
  is_read: z.boolean().default(false),
  photo_path: photoPathSchema.nullable().optional(),
  x0: edge,
  x1: edge,
});
