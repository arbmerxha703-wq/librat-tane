import type { Book } from "./types";
import { normalize } from "./normalize";
import { SHELF_TILES } from "./tiles";
import { accessToken, getSession, refreshSession, setSession } from "./session";

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

const OFFLINE = "Nuk ka lidhje me internetin.";

async function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
  try {
    return await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(OFFLINE, 0);
  }
}

/**
 * Calls the app's server as the signed-in account. When the server no longer accepts the session it
 * is refreshed once; if that fails too, the account is signed out on this phone (the app then shows
 * the sign-in screen).
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = async (fresh: boolean) => {
    try {
      return fresh ? ((await refreshSession())?.access_token ?? null) : await accessToken();
    } catch {
      throw new ApiError(OFFLINE, 0);
    }
  };
  let res = await send(path, init, await token(false));
  if (res.status === 401 && getSession()) {
    const fresh = await token(true);
    if (fresh) res = await send(path, init, fresh);
    if (res.status === 401) setSession(null);
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

/** A loan older than this is shown as overdue. */
const LATE_AFTER_DAYS = 30;

export function loanInfo(book: Book): { text: string; late: boolean } | null {
  if (!book.loaned_to || !book.loaned_at) return null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(book.loaned_at).getTime()) / 86_400_000));
  const since = days === 0 ? "që sot" : days === 1 ? "prej 1 dite" : `prej ${days} ditësh`;
  return { text: `Te ${book.loaned_to} · ${since}`, late: days > LATE_AFTER_DAYS };
}

const BORROWERS_KEY = "librat-borrowers";

/** Names used before on this phone, so lending to the same person is one tap. */
export function getBorrowers(): string[] {
  try {
    return JSON.parse(read(BORROWERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function rememberBorrower(name: string) {
  const list = [name, ...getBorrowers().filter((n) => n.toLowerCase() !== name.toLowerCase())].slice(0, 8);
  write(BORROWERS_KEY, JSON.stringify(list));
}

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
