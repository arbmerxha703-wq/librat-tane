import "server-only";
import { normalize } from "./normalize";
import { SHELF_TILES as TILES } from "./tiles";

export { TILES };

export const SHELF_PROMPT = `You get 3 photos. Together they show ONE bookshelf in a family home library in Albania, from LEFT to RIGHT:
photo 1 = left part, photo 2 = middle part, photo 3 = right part. Neighbouring photos overlap a little. A photo may have a plain black area on its right side: ignore it.

For EACH photo separately, list EVERY book you can see in that photo, from left to right.
- Include VERY THIN books (booklets, pamphlets, a few millimetres wide). Check every narrow strip: a strip with its own colour or text is a book.
- Include books cut off at the left or right edge of a photo.
- Spine text is rotated. Read along the spine and keep the words in the printed order.
- If what you read matches a real published book, write its correct official title and author.
- Keep Albanian accents (ë, ç). Normal capitalization ("Kronikë në gur", not "KRONIKË NË GUR").
- Leave out publishers, series names and volume numbers.
- If you see a book but cannot read its title, still include it with title "".
- Ignore objects that are not books.

Write each book as [title, author, left, right]: author "" if not shown and not sure; left/right = edges of the spine in THAT photo, whole numbers 0 to 1000 of the photo width.
Reply with ONLY this JSON object (one list per photo), no other text:
{"p":[[["Kronikë në gur","Ismail Kadare",120,160]],[],[]]}`;

export type ScannedBook = { title: string; author: string; x0: number | null; x1: number | null };

function similarity(a: string, b: string): number {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/**
 * Reads the per-photo book rows out of the model's reply, even when the reply was cut off by the
 * free tier's length limit: every complete [title, author, left, right] row is kept.
 * Rows sit three brackets deep: [ photos [ photo [ row ] ] ].
 */
export function extractTileRows(text: string): unknown[][][] {
  const tiles: unknown[][][] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let rowStart = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") {
      depth++;
      if (depth === 2) tiles.push([]);
      if (depth === 3) rowStart = i;
    } else if (ch === "]") {
      if (depth === 3 && rowStart !== -1 && tiles.length) {
        try {
          tiles[tiles.length - 1].push(JSON.parse(text.slice(rowStart, i + 1)));
        } catch {
          // a malformed row is skipped; the rest are still useful
        }
        rowStart = -1;
      }
      depth = Math.max(0, depth - 1);
    }
  }
  return tiles;
}

/**
 * Joins the three per-tile lists into one left-to-right list.
 * Overlap duplicates are found by title (positions from the model are too rough to trust for this),
 * and each spine's edges are converted to 0–1000 of the whole photo for highlighting.
 */
export function mergeTiles(lists: unknown[][][], widthFracs: number[]): ScannedBook[] {
  let merged: ScannedBook[] = [];
  lists.slice(0, TILES.length).forEach((list, k) => {
    const [a, b] = TILES[k];
    const wf = widthFracs[k] || 1;
    const rows: ScannedBook[] = (Array.isArray(list) ? list : []).filter(Array.isArray).map((row) => {
      const [t, au, l, r] = row as unknown[];
      // Edges come relative to the square tile; the photo content fills only `wf` of its width.
      const L = a + (b - a) * Math.min(1, Number(l) / 1000 / wf);
      const R = a + (b - a) * Math.min(1, Number(r) / 1000 / wf);
      const ok = Number.isFinite(L) && Number.isFinite(R) && R > L;
      return {
        title: String(t ?? "").trim(),
        author: String(au ?? "").trim(),
        x0: ok ? Math.round(L * 1000) : null,
        x1: ok ? Math.round(R * 1000) : null,
      };
    });
    if (merged.length === 0) {
      merged = rows;
      return;
    }
    // Books at the start of this tile that match the end of the previous one are the overlap: drop them.
    const tail = merged.slice(-6);
    let cut = -1;
    rows.slice(0, 6).forEach((row, i) => {
      if (row.title && tail.some((t) => similarity(t.title, row.title) > 0.75)) cut = i;
    });
    merged = merged.concat(rows.slice(cut + 1));
  });
  return merged.slice(0, 80);
}
