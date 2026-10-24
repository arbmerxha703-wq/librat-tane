import type { Book } from "./types";
import { normalize } from "./normalize";
import { SHELF_TILES } from "./tiles";

const PASSCODE_KEY = "librat-passcode";
const LAST_SHELF_KEY = "librat-last-shelf";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode) — the app still works for this visit.
  }
}

export const getSavedPasscode = () => read(PASSCODE_KEY);
export const savePasscode = (code: string | null) => write(PASSCODE_KEY, code);
export const getLastShelf = () => read(LAST_SHELF_KEY) ?? "";
export const saveLastShelf = (shelf: string) => write(LAST_SHELF_KEY, shelf);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Seconds the server asked us to wait (free-tier photo reading limit). */
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, passcode: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", "x-passcode": passcode, ...init.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Nuk ka lidhje me internetin.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? "Diçka shkoi keq.", res.status, body.retryAfter);
  return body as T;
}

/** First free position on a shelf: one after the highest position already used there. */
export function nextPosition(books: Book[], shelf: string): number {
  const key = normalize(shelf);
  if (!key) return 1;
  const onShelf = books.filter((b) => normalize(b.shelf) === key);
  return onShelf.length ? Math.max(...onShelf.map((b) => b.position)) + 1 : 1;
}

const SPINE_COLORS = ["#8b2e2e", "#2e5d4b", "#2f4a7a", "#8a6420", "#5b3a6e", "#a0522d", "#3e6b6b", "#6b4226"];

export function spineColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPINE_COLORS[h % SPINE_COLORS.length];
}

export const booksLabel = (n: number) => (n === 1 ? "1 libër" : `${n} libra`);

/**
 * Opens a camera photo. An <img> handles large phone photos and their rotation more reliably than
 * createImageBitmap on iOS; the load event is used because img.decode() never settles in some browsers.
 */
async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
      img.src = url;
    });
    return img;
  } catch {
    throw new Error("Fotografia nuk u hap. Provoni përsëri.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toJpeg = (canvas: HTMLCanvasElement) => canvas.toDataURL("image/jpeg", 0.85).split(",")[1];

function shrink(img: HTMLImageElement, maxSide: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return toJpeg(canvas);
}

/** Shrink a camera photo so the upload stays small and fast. Returns base64 JPEG without prefix. */
export async function photoToBase64(file: File, maxSide = 1400): Promise<string> {
  return shrink(await loadImage(file), maxSide);
}

/**
 * Prepares a shelf photo for reading: a display copy, plus left/middle/right parts cut from the
 * full-resolution photo and padded to squares, so thin spines and small print stay legible.
 */
export async function prepareShelfPhoto(file: File) {
  const img = await loadImage(file);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const tiles = SHELF_TILES.map(([a, b]) => {
    const sx = a * W;
    const sw = (b - a) * W;
    const side = Math.max(sw, H);
    const scale = Math.min(1, 1600 / side);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.round(side * scale);
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#000";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, sx, 0, sw, H, 0, 0, sw * scale, H * scale);
    return { image: toJpeg(canvas), widthFrac: sw / side };
  });
  return { photo: shrink(img, 1600), tiles };
}
