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

export const bookSchema = z.object({
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().max(200).default(""),
  shelf: z.string().trim().min(1).max(50),
  position: z.coerce.number().int().min(0).max(100000),
  is_read: z.boolean().default(false),
});
