import { z } from "zod";
import { jpegSchema, json, serverError } from "@/lib/api";
import { requireLibrary } from "@/lib/auth";
import { normalize } from "@/lib/normalize";
import type { Store } from "@/lib/store";
import type { LibraryMap } from "@/lib/types";

/** The map with a short-lived link for each zone photo. */
async function withUrls(store: Store, map: LibraryMap) {
  const urls = await store.photoUrls(map.zones.map((z) => z.path));
  return { zones: map.zones.map((z) => ({ ...z, url: urls[z.path] ?? null })) };
}

/** Photos of the library ("zones") and where each shelf is on them. */
export async function GET(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  try {
    return json(await withUrls(store, await store.getMap()));
  } catch (err) {
    return serverError(err);
  }
}

const photoSchema = z.object({
  photo: jpegSchema,
  name: z.string().trim().min(1).max(60),
  /** Replace this zone's photo (its shelf marks no longer fit, so they are cleared); omit to add a zone. */
  zoneId: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const parsed = photoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Fotografia nuk u pranua." }, 400);
  const { photo, name, zoneId } = parsed.data;
  try {
    const map = await store.getMap();
    const path = await store.savePhoto("map", photo);
    const zones = zoneId
      ? map.zones.map((z) => (z.id === zoneId ? { ...z, name, path, marks: {} } : z))
      : [...map.zones, { id: crypto.randomUUID(), name, path, marks: {} }];
    await store.setMap({ zones });
    return json(await withUrls(store, { zones }));
  } catch (err) {
    return serverError(err);
  }
}

const markSchema = z.object({
  zoneId: z.string().max(60),
  shelf: z.string().trim().min(1).max(50),
  // null removes the mark
  point: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).nullable(),
});

/** Marks where a shelf is. A shelf has one place, so its mark is removed from every other zone. */
export async function PATCH(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const parsed = markSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Kërkesë e pasaktë." }, 400);
  const { zoneId, shelf, point } = parsed.data;
  try {
    const map = await store.getMap();
    const zones = map.zones.map((z) => {
      const marks = Object.fromEntries(Object.entries(z.marks).filter(([name]) => normalize(name) !== normalize(shelf)));
      if (z.id === zoneId && point) marks[shelf] = point;
      return { ...z, marks };
    });
    await store.setMap({ zones });
    return json(await withUrls(store, { zones }));
  } catch (err) {
    return serverError(err);
  }
}

const deleteSchema = z.object({ zoneId: z.string().max(60) });

/** Removes a zone photo and its marks (the books themselves are not touched). */
export async function DELETE(req: Request) {
  const store = await requireLibrary(req);
  if (store instanceof Response) return store;
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Kërkesë e pasaktë." }, 400);
  try {
    const map = await store.getMap();
    const zones = map.zones.filter((z) => z.id !== parsed.data.zoneId);
    await store.setMap({ zones });
    return json(await withUrls(store, { zones }));
  } catch (err) {
    return serverError(err);
  }
}
