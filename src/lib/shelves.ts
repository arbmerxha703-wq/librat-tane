import type { Book } from "./types";
import { normalize } from "./normalize";

/**
 * Eight colours that are easy to tell apart and easy to buy as round stickers. A shelf keeps its
 * colour forever: shelf "1" is always blue, "2" red… so the sticker on the real shelf and the colour
 * in the app always agree. Shelves named with words get a colour from their name.
 */
const SHELF_COLORS = [
  { name: "blu", hex: "#2f6fd6" },
  { name: "e kuqe", hex: "#d64035" },
  { name: "e gjelbër", hex: "#2e9a4f" },
  { name: "portokalli", hex: "#ee8a1c" },
  { name: "vjollcë", hex: "#8a4fc9" },
  { name: "e verdhë", hex: "#e6c21e" },
  { name: "rozë", hex: "#e05a9c" },
  { name: "kafe", hex: "#8a5a35" },
] as const;

export type ShelfColor = (typeof SHELF_COLORS)[number];

export function shelfColor(shelf: string): ShelfColor {
  const s = shelf.trim();
  const n = /^\d+$/.test(s) ? Number(s) - 1 : [...normalize(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return SHELF_COLORS[((n % SHELF_COLORS.length) + SHELF_COLORS.length) % SHELF_COLORS.length];
}

/** Dark text on the light colours (yellow, orange), white on the rest. */
export const shelfInk = (c: ShelfColor) => (c.name === "e verdhë" || c.name === "portokalli" ? "#2b2108" : "#ffffff");

/**
 * Books already in the catalog that look like the one being added: the same ISBN, or the same title
 * (ignoring accents and case) when the authors don't clearly differ.
 */
export function findDuplicates(books: Book[], title: string, author: string, isbn: string | null): Book[] {
  const t = normalize(title);
  const a = normalize(author);
  if (!t && !isbn) return [];
  return books.filter((b) => {
    if (isbn && b.isbn === isbn) return true;
    if (!t || normalize(b.title) !== t) return false;
    const ba = normalize(b.author);
    return !a || !ba || ba.includes(a) || a.includes(ba);
  });
}
