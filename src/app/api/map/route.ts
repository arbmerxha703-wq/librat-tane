import { z } from "zod";
import { jpegSchema, json, requirePasscode, serverError } from "@/lib/api";
import { getStore } from "@/lib/store";
import type { LibraryMap } from "@/lib/types";

async function withUrl(map: LibraryMap) {
  const url = map.path ? ((await getStore().photoUrls([map.path]))[map.path] ?? null) : null;
  return { ...map, url };
}

/** The photo of the whole bookcase and where each shelf is on it. */
export async function GET(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  try {
    return json(await withUrl(await getStore().getMap()));
  } catch (err) {
    return serverError(err);
  }
}

const photoSchema = z.object({ photo: jpegSchema });

/** Replaces the bookcase photo. Old shelf marks no longer match the new photo, so they are cleared. */
export async function POST(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const parsed = photoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Fotografia nuk u pranua." }, 400);
  try {
    const store = getStore();
    const map: LibraryMap = { path: await store.savePhoto("map", parsed.data.photo), marks: {} };
    await store.setMap(map);
    return json(await withUrl(map));
  } catch (err) {
    return serverError(err);
  }
}

const markSchema = z.object({
  shelf: z.string().trim().min(1).max(50),
  // null removes the mark
  point: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).nullable(),
});

/** Marks (or unmarks) where a shelf is on the bookcase photo. */
export async function PATCH(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const parsed = markSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Kërkesë e pasaktë." }, 400);
  try {
    const store = getStore();
    const map = await store.getMap();
    const marks = { ...map.marks };
    if (parsed.data.point) marks[parsed.data.shelf] = parsed.data.point;
    else delete marks[parsed.data.shelf];
    await store.setMap({ ...map, marks });
    return json(await withUrl({ ...map, marks }));
  } catch (err) {
    return serverError(err);
  }
}
